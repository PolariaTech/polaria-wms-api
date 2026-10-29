import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
import {
  extractFiles,
  type ArchivoExtraido,
  type ArchivoImagen,
  type ArchivoNoLegible,
  type ArchivoSubido,
  type ArchivoTexto,
} from '../ai/file-extractors';
import {
  ExtraccionTruncadaError,
  extraerPedido,
  type PedidoExtraido,
  type ResultadoExtraccion,
  type UsoOpenAI,
} from '../ai/openai-pedido.client';
import {
  verificarTotalDocumento,
  type VerificacionTotalDocumento,
} from '../ai/utils/checksum-total-documento';
import {
  ocDesdeNombreArchivo,
  ocsDesdeEtiquetaPedido,
} from '../ai/utils/normalize-numero-pedido';
import {
  construirBloques,
  partirTextoEnPaginas,
} from '../ai/utils/pdf-paginas';
import { buildTextoOrigenPedido } from '../ai/utils/texto-origen-pedido';
import { stampOrigenCorreoMeta } from '../ai/utils/stamp-origen-correo-meta';
import {
  groupOrigenCorreoToOrdenesTrabajo,
  type OrigenCorreoRenglon,
} from '../ai/utils/origen-correo-ordenes-trabajo';
import { recordOrdenVentaAudit } from '../utils/record-orden-venta-audit';
import { sanitizeTelefonoContactoOrNull } from '../ai/utils/sanitize-telefono-contacto';

const PRESENTACIONES = [
  '',
  'Caja 1.5 kg',
  'Caja 20 kg',
  'Caja 21 kg',
  'Granel',
] as const;

const MAX_FILES = 8;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

function catalogKey(nombre: string, codigo: string): string {
  return `${nombre} (${codigo})`;
}

function tituloFromMetadatos(metadatos: unknown): string | null {
  if (!metadatos || typeof metadatos !== 'object') return null;
  const titulo = (metadatos as { titulo?: unknown }).titulo;
  return typeof titulo === 'string' && titulo.trim() ? titulo.trim() : null;
}

/** Llamadas a OpenAI simultáneas por solicitud (un documento o un bloque cada una). */
const MAX_DOCUMENTOS_EN_PARALELO = 3;

/** Bloques de un mismo documento que se leen a la vez. */
const MAX_BLOQUES_EN_PARALELO = 5;

/**
 * Documentos con más texto que esto se leen por bloques en paralelo desde el inicio
 * (≈ 45 renglones): una sola llamada tardaría minutos y rozaría el tope de salida.
 */
const UMBRAL_LECTURA_POR_BLOQUES = 6000;

const RE_CUERPO_CORREO = /—\s*cuerpo$/i;
const SEPARADOR_ADJUNTO_EML = ' → ';

export type CodigoAdvertenciaLectura =
  | 'OC_DISCREPA'
  | 'OC_REPETIDA'
  | 'SIN_TOTAL_DOCUMENTO'
  | 'TOTAL_NO_CUADRA'
  | 'DOCUMENTO_NO_LEGIBLE'
  | 'ADJUNTO_DUPLICADO'
  | 'ADJUNTO_RECHAZADO'
  | 'ADJUNTOS_EXCEDEN_TOPE'
  | 'EXPECTATIVA_OT_DISTINTA'
  | 'EXPECTATIVA_IMPORTE_DISTINTO';

export interface AdvertenciaLectura {
  codigo: CodigoAdvertenciaLectura;
  documento?: string;
  detalle: string;
}

export interface DocumentoLeido {
  nombre: string;
  /** OC del documento (contenido «No. Pedido» y/o nombre del archivo). */
  oc: string | null;
  ocFuente: 'contenido' | 'nombre' | 'ambas' | null;
  renglones: number;
  verificacion: VerificacionTotalDocumento;
  /** Se releyó por bloques porque la lectura completa se cortó o no cuadraba. */
  relecturaPorBloques: boolean;
}

export interface LecturaPorDocumento {
  pedido: PedidoExtraido;
  textoOrigen: string;
  documentos: DocumentoLeido[];
  advertencias: AdvertenciaLectura[];
  catalogoProductos: number;
  tokensTotal: number;
  costoUSD: number | null;
}

export interface DocumentoParaLeer {
  nombre: string;
  archivos: ArchivoExtraido[];
  /** Solo los documentos de texto (PDF/Excel/Word) se pueden releer por bloques. */
  esTexto: boolean;
}

/** `correo.eml → AGUACATES_4502987081.pdf` → `aguacates_4502987081.pdf`. */
export function nombreBaseAdjunto(nombre: string): string {
  const i = nombre.lastIndexOf(SEPARADOR_ADJUNTO_EML);
  return (i >= 0 ? nombre.slice(i + SEPARADOR_ADJUNTO_EML.length) : nombre)
    .trim()
    .toLowerCase();
}

/**
 * Separa lo que el extractor devolvió en: contexto (cuerpos de correo), documentos (cada
 * PDF/Excel/Word es uno) y no legibles. Un adjunto incrustado en un .eml que además se
 * subió suelto se descarta (se leía dos veces). Las imágenes son un solo documento, o
 * van con el primero si hay documentos de texto (una foto no es un pedido aparte).
 */
export function separarContextoYDocumentos(extraidos: readonly ArchivoExtraido[]): {
  contexto: ArchivoTexto[];
  documentos: DocumentoParaLeer[];
  noLegibles: ArchivoNoLegible[];
  duplicados: string[];
} {
  const contexto: ArchivoTexto[] = [];
  const textos: ArchivoTexto[] = [];
  const imagenes: ArchivoImagen[] = [];
  const noLegibles: ArchivoNoLegible[] = [];

  for (const archivo of extraidos) {
    if (archivo.tipo === 'no_legible') noLegibles.push(archivo);
    else if (archivo.tipo === 'imagen') imagenes.push(archivo);
    else if (RE_CUERPO_CORREO.test(archivo.nombre)) contexto.push(archivo);
    else textos.push(archivo);
  }

  const sueltos = new Set(
    textos
      .filter((t) => !t.nombre.includes(SEPARADOR_ADJUNTO_EML))
      .map((t) => nombreBaseAdjunto(t.nombre)),
  );

  const duplicados: string[] = [];
  const documentos: DocumentoParaLeer[] = [];
  for (const texto of textos) {
    const incrustado = texto.nombre.includes(SEPARADOR_ADJUNTO_EML);
    if (incrustado && sueltos.has(nombreBaseAdjunto(texto.nombre))) {
      duplicados.push(texto.nombre);
      continue;
    }
    documentos.push({ nombre: texto.nombre, archivos: [texto], esTexto: true });
  }

  if (imagenes.length > 0) {
    if (documentos.length > 0) {
      documentos[0]!.archivos = [...documentos[0]!.archivos, ...imagenes];
    } else {
      documentos.push({
        nombre: imagenes.map((i) => i.nombre).join(', '),
        archivos: imagenes,
        esTexto: false,
      });
    }
  }

  return { contexto, documentos, noLegibles, duplicados };
}

/** Ejecuta `fn` sobre cada elemento con a lo sumo `limite` en vuelo; conserva el orden. */
export async function mapConLimite<T, R>(
  items: readonly T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const resultados = new Array<R>(items.length);
  let siguiente = 0;
  const trabajadores = Array.from(
    { length: Math.min(limite, items.length) },
    async () => {
      while (siguiente < items.length) {
        const indice = siguiente;
        siguiente += 1;
        resultados[indice] = await fn(items[indice]!, indice);
      }
    },
  );
  await Promise.all(trabajadores);
  return resultados;
}

export function sumarUso(usos: ReadonlyArray<UsoOpenAI | null>): UsoOpenAI | null {
  const validos = usos.filter((u): u is UsoOpenAI => u !== null);
  if (validos.length === 0) return null;
  const costos = validos.map((u) => u.costoUSD);
  return {
    tokensEntrada: validos.reduce((s, u) => s + u.tokensEntrada, 0),
    tokensEntradaCacheados: validos.reduce((s, u) => s + u.tokensEntradaCacheados, 0),
    tokensEntradaCacheEscritura: validos.reduce(
      (s, u) => s + u.tokensEntradaCacheEscritura,
      0,
    ),
    tokensSalida: validos.reduce((s, u) => s + u.tokensSalida, 0),
    tokensTotal: validos.reduce((s, u) => s + u.tokensTotal, 0),
    costoUSD: costos.some((c) => c === null)
      ? null
      : costos.reduce<number>((s, c) => s + (c ?? 0), 0),
  };
}

/**
 * Une lecturas de varios documentos (o de varios bloques de un documento): los campos de
 * cabecera salen del primero que los trae; renglones y líneas se concatenan.
 */
export function fusionarPedidos(pedidos: readonly PedidoExtraido[]): PedidoExtraido {
  if (pedidos.length === 1) return pedidos[0]!;

  const base = { ...pedidos[0]! } as unknown as Record<string, unknown>;
  for (const clave of Object.keys(base)) {
    if (Array.isArray(base[clave])) continue;
    const valor = pedidos
      .map((p) => (p as unknown as Record<string, unknown>)[clave])
      .find((v) => v !== null && v !== undefined && v !== '');
    base[clave] = valor ?? base[clave];
  }

  const unido = base as unknown as PedidoExtraido;
  unido.lineas = pedidos.flatMap((p) => p.lineas);
  unido.origenCorreo = pedidos
    .flatMap((p) => p.origenCorreo)
    .map((renglon, indice) => ({ ...renglon, _lineaIndex: indice }));
  unido.archivosNoLegibles = [
    ...new Set(pedidos.flatMap((p) => p.archivosNoLegibles)),
  ];
  const advertencias = [
    ...new Set(pedidos.map((p) => p.advertencia).filter((a): a is string => !!a)),
  ];
  unido.advertencia = advertencias.length > 0 ? advertencias.join(' | ') : null;
  return unido;
}

/** Código de almacén del cliente dentro de un nombre: `AR87` en «FYV AR87 Rest Medit 20». */
const CODIGO_ALMACEN_RE = /(?:^|\s)([A-Z][A-Z0-9]{3})(?=\s|$)/;

function codigoDeAlmacen(almacen: string): string | null {
  return CODIGO_ALMACEN_RE.exec(almacen.trim())?.[1] ?? null;
}

/**
 * Al leer un documento por bloques, la IA puede escribir el mismo almacén de dos formas
 * («FYV AR87 Rest Medit 20» y «AR87 Rest Medit 20»), y entonces una OT se parte en dos sin
 * que el total lo delate. Dentro de UN documento, los nombres de almacén que comparten el
 * mismo código se unifican al más frecuente. Solo toca nombres con el mismo código.
 */
export function unificarAlmacenesPorCodigo(pedido: PedidoExtraido): void {
  const conteo = new Map<string, Map<string, number>>();
  const contar = (almacen: string | null | undefined) => {
    const nombre = (almacen ?? '').trim();
    const codigo = nombre ? codigoDeAlmacen(nombre) : null;
    if (!codigo) return;
    const porNombre = conteo.get(codigo) ?? new Map<string, number>();
    porNombre.set(nombre, (porNombre.get(nombre) ?? 0) + 1);
    conteo.set(codigo, porNombre);
  };
  for (const renglon of pedido.origenCorreo) contar(renglon.Almacen);
  for (const linea of pedido.lineas) contar(linea.almacen);

  const canonico = new Map<string, string>();
  for (const [codigo, porNombre] of conteo) {
    if (porNombre.size < 2) continue;
    const ordenados = [...porNombre.entries()].sort(
      (a, b) => b[1] - a[1] || b[0].length - a[0].length,
    );
    canonico.set(codigo, ordenados[0]![0]);
  }
  if (canonico.size === 0) return;

  const unificar = (almacen: string | null | undefined): string | null => {
    const nombre = (almacen ?? '').trim();
    const codigo = nombre ? codigoDeAlmacen(nombre) : null;
    return (codigo && canonico.get(codigo)) || (almacen ?? null);
  };
  for (const renglon of pedido.origenCorreo) {
    renglon.Almacen = unificar(renglon.Almacen) ?? '';
  }
  for (const linea of pedido.lineas) linea.almacen = unificar(linea.almacen);
}

/**
 * La OC de un documento sale de su propio «No. Pedido». Si el documento rotula UNA sola,
 * se impone a todas sus líneas (evita que `normalizeNumeroPedidoFields` la funda con la
 * de otro PDF al ver varios archivos juntos). Con 0 o varias etiquetas no se impone nada
 * (p. ej. un documento con varios PO por almacén conserva los suyos).
 */
export function imponerOcDelDocumento(
  pedido: PedidoExtraido,
  textoDocumento: string,
  nombreDocumento: string,
): {
  oc: string | null;
  fuente: DocumentoLeido['ocFuente'];
  discrepa: boolean;
  ocContenido: string | null;
  ocNombre: string | null;
} {
  const etiquetas = ocsDesdeEtiquetaPedido(textoDocumento);
  const ocContenido = etiquetas.length === 1 ? etiquetas[0]! : null;
  const ocNombre = ocDesdeNombreArchivo(nombreDocumento);

  if (ocContenido) {
    pedido.ordenCompraHotel = ocContenido;
    for (const linea of pedido.lineas) linea.numeroPedido = ocContenido;
    for (const renglon of pedido.origenCorreo) {
      renglon['Numero pedido'] = ocContenido;
    }
  }

  const oc = ocContenido ?? (etiquetas.length === 0 ? ocNombre : null);
  let fuente: DocumentoLeido['ocFuente'] = null;
  if (ocContenido && ocNombre) {
    fuente = ocContenido === ocNombre ? 'ambas' : 'contenido';
  } else if (ocContenido) {
    fuente = 'contenido';
  } else if (oc) {
    fuente = 'nombre';
  }

  return {
    oc,
    fuente,
    discrepa: Boolean(ocContenido && ocNombre && ocContenido !== ocNombre),
    ocContenido,
    ocNombre,
  };
}

@Injectable()
export class PedidoIaService {
  private readonly logger = new Logger(PedidoIaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tenantLocator: TenantSchemaLocator,
  ) {}

  async extraerArchivos(files: Express.Multer.File[]): Promise<ArchivoExtraido[]> {
    this.assertFiles(files);
    const uploaded = this.toArchivosSubidos(files);
    return extractFiles(uploaded);
  }

  /**
   * Lee un pedido: texto pegado y/o archivos (Multer). Contrato HTTP de `leer-pedido` e
   * `ingestar-pedido`, sin cambios; la lectura en sí vive en `leerArchivosParaCuenta`.
   */
  async leerPedido(input: {
    codigoCuenta: string;
    cliente?: string;
    texto: string;
    files: Express.Multer.File[];
    numeroCorreo?: string;
    horario?: string;
    /** Si viene de JWT+tenant; si no, se resuelve por codigoCuenta (API key). */
    ctx?: TenantContext | null;
  }): Promise<
    PedidoExtraido & {
      textoOrigen: string | null;
      documentos: DocumentoLeido[];
      advertencias: AdvertenciaLectura[];
    }
  > {
    const codigoCuenta = input.codigoCuenta.trim();
    if (!codigoCuenta) {
      throw new BadRequestException('Falta codigoCuenta.');
    }

    const texto = input.texto?.trim() || '';
    if (!texto && input.files.length === 0) {
      throw new BadRequestException('No hay texto ni archivos que leer.');
    }
    this.assertFiles(input.files);

    const ctx =
      input.ctx?.schemaName != null || input.ctx?.codigoCuenta
        ? input.ctx
        : await this.buildIntegrationTenantContext(codigoCuenta);

    const inicio = Date.now();

    try {
      const lectura = await this.leerArchivosParaCuenta({
        codigoCuenta,
        ctx: ctx!,
        texto,
        archivos: this.toArchivosSubidos(input.files),
      });

      const origenCorreo = stampOrigenCorreoMeta(
        lectura.pedido.origenCorreo ?? [],
        {
          numeroCorreo: input.numeroCorreo,
          horario: input.horario,
        },
      );

      this.logger.log(
        JSON.stringify({
          evento: 'leer-pedido',
          exito: true,
          cliente: input.cliente?.trim() || '(sin cliente)',
          codigoCuenta,
          catalogoProductos: lectura.catalogoProductos,
          archivos: input.files.length,
          documentos: lectura.documentos.length,
          renglones: origenCorreo.length,
          totalesQueNoCuadran: lectura.documentos.filter(
            (d) => d.verificacion.cuadra === false,
          ).length,
          textoOrigenChars: lectura.textoOrigen.length,
          duracionMs: Date.now() - inicio,
          tokensTotal: lectura.tokensTotal,
          costoUSD: lectura.costoUSD,
        }),
      );

      return {
        ...lectura.pedido,
        origenCorreo,
        textoOrigen: lectura.textoOrigen || null,
        documentos: lectura.documentos,
        advertencias: lectura.advertencias,
      };
    } catch (err) {
      this.logger.error(
        JSON.stringify({
          evento: 'leer-pedido',
          exito: false,
          codigoCuenta,
          archivos: input.files.length,
          duracionMs: Date.now() - inicio,
        }),
      );

      if (err instanceof OpenAI.APIError) {
        throw new ServiceUnavailableException(
          'El servicio de IA no está disponible en este momento. Intenta de nuevo.',
        );
      }
      throw err;
    }
  }

  /**
   * Lectura con IA por DOCUMENTO (REQ-187). Núcleo compartido por `leer-pedido`,
   * `ingestar-pedido` y la corrección contra el correo del chat de OT.
   *
   * Medido con OV-940/943: una sola llamada con varios PDF hace que el modelo omita
   * renglones o un PDF completo, y el .eml trae sus adjuntos incrustados (se leían dos
   * veces). Aquí cada PDF/Excel/Word se lee en su propia llamada con el cuerpo del correo
   * como contexto, se impone la OC de cada documento, se verifica la suma contra su
   * «Total pedido» y, si no cuadra o la respuesta se corta, se relee por bloques.
   */
  async leerArchivosParaCuenta(input: {
    codigoCuenta: string;
    ctx: TenantContext;
    texto: string;
    archivos: ArchivoSubido[];
  }): Promise<LecturaPorDocumento> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Falta configurar OPENAI_API_KEY en el servidor para leer pedidos con IA.',
      );
    }

    const catalogoClaves = await this.listCatalogoClaves(
      input.codigoCuenta,
      input.ctx,
    );
    if (catalogoClaves.length === 0) {
      throw new BadRequestException(
        'No hay productos en el catálogo de esta cuenta. Revisa el esquema/tenant o el alta de productos.',
      );
    }

    const archivosExtraidos = await extractFiles(input.archivos);
    const textoOrigen = buildTextoOrigenPedido(input.texto, archivosExtraidos);
    const hoyISO = new Date().toISOString().slice(0, 10);
    const { contexto, documentos, noLegibles, duplicados } =
      separarContextoYDocumentos(archivosExtraidos);

    const advertencias: AdvertenciaLectura[] = duplicados.map((nombre) => ({
      codigo: 'ADJUNTO_DUPLICADO',
      documento: nombre,
      detalle:
        'Adjunto incrustado en el .eml que también se subió suelto: se leyó una sola vez.',
    }));

    // Sin documentos (mensaje pegado o solo el cuerpo del correo): una sola lectura.
    const aLeer: DocumentoParaLeer[] =
      documentos.length > 0
        ? documentos
        : [{ nombre: 'mensaje', archivos: [], esTexto: false }];

    const uso = { tokensTotal: 0, costoUSD: 0, costoConocido: true };
    const lecturas = await mapConLimite(
      aLeer,
      MAX_DOCUMENTOS_EN_PARALELO,
      async (documento) => {
        const lectura = await this.leerUnDocumento({
          texto: input.texto,
          contexto,
          documento,
          catalogoClaves,
          hoyISO,
        });
        uso.tokensTotal += lectura.tokensTotal;
        if (lectura.costoUSD === null) uso.costoConocido = false;
        else uso.costoUSD += lectura.costoUSD;
        return lectura;
      },
    );

    const ocsVistas = new Map<string, string>();
    const documentosLeidos: DocumentoLeido[] = [];
    for (const lectura of lecturas) {
      advertencias.push(...lectura.advertencias);
      documentosLeidos.push(lectura.documento);
      const oc = lectura.documento.oc;
      if (oc) {
        const previo = ocsVistas.get(oc);
        if (previo) {
          advertencias.push({
            codigo: 'OC_REPETIDA',
            documento: lectura.documento.nombre,
            detalle: `La OC ${oc} también está en «${previo}»: no se suman, revisa si es el mismo pedido.`,
          });
        } else {
          ocsVistas.set(oc, lectura.documento.nombre);
        }
      }
    }

    const pedido = fusionarPedidos(lecturas.map((l) => l.pedido));
    pedido.archivosNoLegibles = [
      ...new Set([
        ...pedido.archivosNoLegibles,
        ...noLegibles.map((f) => f.nombre),
      ]),
    ];
    for (const noLegible of noLegibles) {
      advertencias.push({
        codigo: 'DOCUMENTO_NO_LEGIBLE',
        documento: noLegible.nombre,
        detalle: noLegible.motivo,
      });
    }

    return {
      pedido,
      textoOrigen,
      documentos: documentosLeidos,
      advertencias,
      catalogoProductos: catalogoClaves.length,
      tokensTotal: uso.tokensTotal,
      costoUSD: uso.costoConocido ? uso.costoUSD : null,
    };
  }

  /** Una llamada por documento, con verificación del total y relectura por bloques. */
  private async leerUnDocumento(input: {
    texto: string;
    contexto: ArchivoTexto[];
    documento: DocumentoParaLeer;
    catalogoClaves: string[];
    hoyISO: string;
  }): Promise<{
    pedido: PedidoExtraido;
    documento: DocumentoLeido;
    advertencias: AdvertenciaLectura[];
    tokensTotal: number;
    costoUSD: number | null;
  }> {
    const { documento, contexto } = input;
    const advertencias: AdvertenciaLectura[] = [];
    const textoDocumento = documento.archivos
      .filter((f): f is ArchivoTexto => f.tipo === 'texto')
      .map((f) => f.contenido)
      .join('\n');

    const leer = (archivos: ArchivoExtraido[]) =>
      extraerPedido({
        texto: input.texto,
        archivosExtraidos: [...contexto, ...archivos],
        hoyISO: input.hoyISO,
        catalogoClaves: input.catalogoClaves,
        presentaciones: [...PRESENTACIONES],
      });

    const leerPorBloques = async (): Promise<ResultadoExtraccion> => {
      const bloques = construirBloques(partirTextoEnPaginas(textoDocumento));
      const partes = await mapConLimite(
        bloques,
        MAX_BLOQUES_EN_PARALELO,
        (bloque, i) =>
          leer([
            {
              nombre: `${documento.nombre} (parte ${i + 1}/${bloques.length})`,
              tipo: 'texto',
              contenido: bloque,
            },
          ]),
      );
      const fusionado = fusionarPedidos(partes.map((p) => p.pedido));
      unificarAlmacenesPorCodigo(fusionado);
      return { pedido: fusionado, uso: sumarUso(partes.map((p) => p.uso)) };
    };

    /** Lectura completa en una llamada; null si se cortó por el tope de salida. */
    const leerCompleto = async (): Promise<ResultadoExtraccion | null> => {
      try {
        return await leer(documento.archivos);
      } catch (err) {
        if (err instanceof ExtraccionTruncadaError) return null;
        throw err;
      }
    };

    // Un pedido largo en una sola llamada tarda minutos (~104 tokens de salida por
    // renglón, medido: 140 s para 134 renglones) y roza el tope de salida del modelo.
    // Por bloques y en paralelo tarda una fracción y cada llamada queda lejos del tope.
    const esLargo =
      documento.esTexto && textoDocumento.length > UMBRAL_LECTURA_POR_BLOQUES;

    let resultado: ResultadoExtraccion;
    let relecturaPorBloques = false;
    if (esLargo) {
      resultado = await leerPorBloques();
      relecturaPorBloques = true;
    } else {
      const completo = await leerCompleto();
      if (completo) {
        resultado = completo;
      } else if (documento.esTexto) {
        resultado = await leerPorBloques();
        relecturaPorBloques = true;
      } else {
        throw new ExtraccionTruncadaError(null);
      }
    }

    let verificacion = verificarTotalDocumento(
      textoDocumento,
      resultado.pedido.origenCorreo,
    );

    // Si no cuadra, se prueba el otro camino y se conserva el que más se acerque al total.
    if (verificacion.cuadra === false && documento.esTexto) {
      const alterno = relecturaPorBloques
        ? await leerCompleto()
        : await leerPorBloques();
      if (alterno) {
        const verificacionAlterna = verificarTotalDocumento(
          textoDocumento,
          alterno.pedido.origenCorreo,
        );
        const mejora =
          verificacionAlterna.cuadra === true ||
          Math.abs(verificacionAlterna.diferencia ?? Infinity) <
            Math.abs(verificacion.diferencia ?? Infinity);
        const uso = sumarUso([resultado.uso, alterno.uso]);
        if (mejora) {
          resultado = { pedido: alterno.pedido, uso };
          verificacion = verificacionAlterna;
          relecturaPorBloques = !relecturaPorBloques;
        } else {
          resultado = { ...resultado, uso };
        }
      }
    }

    if (verificacion.cuadra === false) {
      advertencias.push({
        codigo: 'TOTAL_NO_CUADRA',
        documento: documento.nombre,
        detalle: `La suma de lo leído (${verificacion.importe}) no coincide con el «Total pedido» del documento (${verificacion.totalDocumento}).`,
      });
    } else if (verificacion.cuadra === null && documento.esTexto) {
      advertencias.push({
        codigo: 'SIN_TOTAL_DOCUMENTO',
        documento: documento.nombre,
        detalle: 'El documento no declara «Total pedido»: la lectura no se pudo verificar.',
      });
    }

    const oc = imponerOcDelDocumento(
      resultado.pedido,
      textoDocumento,
      documento.nombre,
    );
    if (oc.discrepa) {
      advertencias.push({
        codigo: 'OC_DISCREPA',
        documento: documento.nombre,
        detalle: `El nombre del archivo indica la OC ${oc.ocNombre} y el contenido ${oc.ocContenido}: se usó la del contenido.`,
      });
    }

    return {
      pedido: resultado.pedido,
      documento: {
        nombre: documento.nombre,
        oc: oc.oc,
        ocFuente: oc.fuente,
        renglones: resultado.pedido.origenCorreo.length,
        verificacion,
        relecturaPorBloques,
      },
      advertencias,
      tokensTotal: resultado.uso?.tokensTotal ?? 0,
      costoUSD: resultado.uso?.costoUSD ?? null,
    };
  }

  /**
   * Extrae el pedido con IA y crea una OV `por_confirmar` con
   * `origen_correo` + `origen_texto` + cabecera de entrega ya llenos.
   * El bot/n8n debe usar esto en lugar de armar el JSON a mano.
   */
  async ingestarPedido(input: {
    codigoCuenta: string;
    idBodega?: string;
    cliente?: string;
    texto: string;
    files: Express.Multer.File[];
    numeroCorreo?: string;
    horario?: string;
    origenArchivos?: string;
  }): Promise<{
    idOrdenVenta: string;
    codigo: string;
    pedido: PedidoExtraido & { textoOrigen: string | null };
  }> {
    const pedido = await this.leerPedido(input);
    const origenCorreo = (pedido.origenCorreo ?? []) as OrigenCorreoRenglon[];
    if (origenCorreo.length === 0) {
      throw new BadRequestException(
        'La IA no extrajo renglones de producto; no se crea la OV.',
      );
    }

    const ctx = await this.buildIntegrationTenantContext(
      input.codigoCuenta.trim(),
    );
    const schema = this.tenantLocator.assertSafeSchemaIdent(
      ctx.schemaName?.trim() || 'public',
    );

    const codigoCuenta = input.codigoCuenta.trim();
    const first = origenCorreo[0]!;
    const pick = (...vals: Array<string | null | undefined>) => {
      for (const v of vals) {
        const t = (v ?? '').trim();
        if (t) return t;
      }
      return null;
    };

    const idBodega = await this.resolveIdBodegaIngest(
      schema,
      codigoCuenta,
      input.idBodega,
    );
    const idCliente = await this.resolveIdClienteIngest(schema, codigoCuenta);
    const idComprador = await this.resolveIdCompradorIngest(
      schema,
      codigoCuenta,
      pick(
        pedido.nombreCliente,
        first['Nombre cliente'],
        input.cliente,
      ),
    );

    const fechaRaw = pick(pedido.fechaEntrega, first.Fecha);
    const fechaEntrega =
      fechaRaw && /^\d{4}-\d{2}-\d{2}/.test(fechaRaw)
        ? fechaRaw.slice(0, 10)
        : fechaRaw;

    let origenArchivos: string | null = input.origenArchivos?.trim() || null;
    if (input.files.length > 0) {
      const {
        uploadOvAdjuntosMulter,
        serializeOrigenArchivosJson,
      } = await import('../ai/upload-ov-adjunto-cloudinary');
      const uploaded = await uploadOvAdjuntosMulter(
        input.files,
        codigoCuenta,
      );
      origenArchivos =
        serializeOrigenArchivosJson(uploaded) ||
        input.files
          .map((f) => f.originalname?.trim())
          .filter(Boolean)
          .join(', ') ||
        origenArchivos;
      if (uploaded.length < input.files.length) {
        this.logger.warn(
          JSON.stringify({
            evento: 'ingestar-pedido-adjuntos',
            codigoCuenta,
            subidos: uploaded.length,
            recibidos: input.files.length,
          }),
        );
      }
    }

    let rows: Array<{ idOrdenVenta: string; codigo: string }>;
    try {
      rows = await this.prisma.$queryRawUnsafe<
        Array<{ idOrdenVenta: string; codigo: string }>
      >(
        `INSERT INTO ${schema}.orden_venta (
           codigo,
           codigo_cuenta,
           id_bodega,
           id_cliente,
           id_comprador,
           estado,
           origen_correo,
           origen_texto,
           origen_archivos,
           orden_compra_hotel,
           centro_consumo,
           contacto_entrega,
           fecha_entrega,
           ventana_desde,
           ventana_hasta,
           direccion_entrega,
           anden,
           telefono_contacto,
           notas_almacen,
           prioridad
         ) VALUES (
           '',
           $1,
           $2::uuid,
           $3::uuid,
           $4::uuid,
           'por_confirmar',
           $5::jsonb,
           $6,
           $7,
           $8,
           $9,
           $10,
           $11,
           $12,
           $13,
           $14,
           $15,
           $16,
           $17,
           $18
         )
         RETURNING id_orden_venta AS "idOrdenVenta", codigo`,
        codigoCuenta,
        idBodega,
        idCliente,
        idComprador,
        JSON.stringify(origenCorreo),
        pedido.textoOrigen,
        origenArchivos,
        pick(pedido.ordenCompraHotel, first['Numero pedido']),
        pick(pedido.centroConsumo, first.Almacen),
        pick(pedido.contacto, first['Responsable externo']),
        fechaEntrega,
        pick(pedido.horarioDesde, first['Ventana desde']),
        pick(pedido.horarioHasta, first['Ventana hasta']),
        pick(pedido.direccion, first['Direccion entrega'], first.Destino),
        pick(pedido.anden, first.Anden),
        sanitizeTelefonoContactoOrNull(
          pick(pedido.telefono, first['Telefono contacto']),
        ),
        pick(pedido.observaciones, first['Notas generales']),
        pick(first.Prioridad),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        JSON.stringify({
          evento: 'ingestar-pedido',
          exito: false,
          codigoCuenta,
          error: msg,
        }),
      );
      if (/cliente .* no pertenece/i.test(msg)) {
        throw new BadRequestException(
          'No se pudo asignar un cliente de catálogo a la OV. Revisa que la cuenta tenga al menos un cliente activo.',
        );
      }
      throw new BadRequestException(
        `No se pudo crear la OV: ${msg.slice(0, 240)}`,
      );
    }

    const created = rows[0];
    if (!created) {
      throw new ServiceUnavailableException(
        'No se pudo crear la orden de venta.',
      );
    }

    this.logger.log(
      JSON.stringify({
        evento: 'ingestar-pedido',
        exito: true,
        codigoCuenta: input.codigoCuenta.trim(),
        idOrdenVenta: created.idOrdenVenta,
        codigo: created.codigo,
        renglones: origenCorreo.length,
      }),
    );

    const otIds = groupOrigenCorreoToOrdenesTrabajo(origenCorreo).map(
      (ot) => ot.id,
    );
    await recordOrdenVentaAudit(this.prisma, {
      schemaName: schema,
      codigoCuenta,
      idOrdenVenta: created.idOrdenVenta,
      accion: 'creacion',
      mensaje:
        otIds.length > 1
          ? `Esta orden de trabajo fue creada por ingestión Mateo / bot (${otIds.length} órdenes de trabajo).`
          : 'Esta orden de trabajo fue creada por ingestión Mateo / bot.',
      idBodega,
      idOrdenesTrabajo: otIds,
      autorNombre: 'Mateo / bot',
      payloadExtra: {
        tipo: 'ingestar_pedido',
        codigo: created.codigo,
        ordenesTrabajo: otIds.length,
      },
    });

    return {
      idOrdenVenta: created.idOrdenVenta,
      codigo: created.codigo,
      pedido,
    };
  }

  /** Cliente de catálogo obligatorio en orden_venta (trigger de referencias). */
  private async resolveIdClienteIngest(
    schema: string,
    codigoCuenta: string,
  ): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ idCliente: string }>
    >(
      `SELECT id_cliente AS "idCliente"
       FROM ${schema}.cliente
       WHERE codigo_cuenta = $1
         AND esta_activo = true
       ORDER BY nombre ASC NULLS LAST
       LIMIT 1`,
      codigoCuenta,
    );
    const id = rows[0]?.idCliente?.trim();
    if (!id) {
      throw new BadRequestException(
        `No hay cliente activo en la cuenta ${codigoCuenta}.`,
      );
    }
    return id;
  }

  /**
   * Comprador por nombre/código (IA/correo).
   * Solo coincidencia exacta (case-insensitive); sin tokens LIKE
   * para evitar falsos positivos críticos de cliente.
   */
  private async resolveIdCompradorIngest(
    schema: string,
    codigoCuenta: string,
    nombreRaw: string | null,
  ): Promise<string | null> {
    const nombre = (nombreRaw ?? '').trim();
    if (!nombre) return null;

    const exact = await this.prisma.$queryRawUnsafe<
      Array<{ idComprador: string }>
    >(
      `SELECT id_comprador AS "idComprador"
       FROM ${schema}.comprador
       WHERE codigo_cuenta = $1
         AND esta_activo = true
         AND (
           lower(trim(nombre)) = lower(trim($2))
           OR lower(trim(coalesce(codigo, ''))) = lower(trim($2))
         )
       LIMIT 1`,
      codigoCuenta,
      nombre,
    );
    return exact[0]?.idComprador ?? null;
  }

  /** Bodega explícita, default de cuenta, o primera activa del tenant. */
  private async resolveIdBodegaIngest(
    schema: string,
    codigoCuenta: string,
    idBodegaRaw?: string,
  ): Promise<string> {
    const explicit = idBodegaRaw?.trim();
    if (explicit) {
      const found = await this.prisma.$queryRawUnsafe<
        Array<{ idBodega: string }>
      >(
        `SELECT id_bodega AS "idBodega"
         FROM ${schema}.bodega
         WHERE id_bodega = $1::uuid
           AND codigo_cuenta = $2
           AND esta_activa = true
         LIMIT 1`,
        explicit,
        codigoCuenta,
      );
      if (!found[0]?.idBodega) {
        throw new BadRequestException(
          'idBodega no pertenece a la cuenta o está inactiva.',
        );
      }
      return found[0].idBodega;
    }

    const fromCuenta = await this.prisma.$queryRawUnsafe<
      Array<{ idBodega: string | null }>
    >(
      `SELECT c.id_bodega_default AS "idBodega"
       FROM ${schema}.cuenta c
       WHERE c.codigo_cuenta = $1
       LIMIT 1`,
      codigoCuenta,
    );
    const defaultId = fromCuenta[0]?.idBodega?.trim();
    if (defaultId) return defaultId;

    const first = await this.prisma.$queryRawUnsafe<
      Array<{ idBodega: string }>
    >(
      `SELECT id_bodega AS "idBodega"
       FROM ${schema}.bodega
       WHERE codigo_cuenta = $1
         AND esta_activa = true
       ORDER BY codigo ASC
       LIMIT 1`,
      codigoCuenta,
    );
    if (!first[0]?.idBodega) {
      throw new BadRequestException(
        'No hay bodega activa ni bodega default para esta cuenta.',
      );
    }
    return first[0].idBodega;
  }

  /** Contexto sintético para llamadas con API key (sin JWT). */
  private async buildIntegrationTenantContext(
    codigoCuenta: string,
  ): Promise<TenantContext> {
    const located = await this.tenantLocator.findCuentaByCodigo(codigoCuenta);
    if (!located) {
      throw new NotFoundException(`Cuenta no encontrada: ${codigoCuenta}`);
    }
    if (!located.empresaEstaActiva) {
      throw new ForbiddenException('La empresa está inactiva');
    }
    if (!located.estaActiva) {
      throw new ForbiddenException('La cuenta está inactiva');
    }

    return {
      idUsuario: 'integration:pedido-ia',
      idRol: WmsRol.operador_cuenta,
      nivelRol: RolNivel.cuenta,
      codigoEmpresa: located.codigoEmpresa,
      codigoCuenta: located.codigoCuenta,
      codigosCuentaEmpresa: [located.codigoCuenta],
      idBodegas: [],
      schemaName: located.schemaName,
    };
  }

  private assertFiles(files: Express.Multer.File[]): void {
    if (files.length > MAX_FILES) {
      throw new BadRequestException('Puedes adjuntar máximo 8 archivos.');
    }
    if (files.some((file) => file.size > MAX_FILE_BYTES)) {
      throw new BadRequestException(
        'Uno de los archivos supera el límite de 15MB.',
      );
    }
  }

  private toArchivosSubidos(files: Express.Multer.File[]): ArchivoSubido[] {
    return files.map((file) => ({
      originalname: file.originalname || 'archivo',
      mimetype: file.mimetype || 'application/octet-stream',
      buffer: file.buffer,
    }));
  }

  private async listCatalogoClaves(
    codigoCuenta: string,
    ctx: TenantContext,
  ): Promise<string[]> {
    // No usar search_path del pool: Supabase/pgbouncer lo ignora y Prisma
    // sigue leyendo public (Tecno funciona; emp_* queda vacío / falla).
    const schema = this.tenantLocator.assertSafeSchemaIdent(
      ctx.schemaName?.trim() || 'public',
    );
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        sku: string | null;
        descripcion: string | null;
        metadatosCatalogo: unknown;
      }>
    >(
      `SELECT sku,
              descripcion,
              metadatos_catalogo AS "metadatosCatalogo"
       FROM ${schema}.producto
       WHERE codigo_cuenta = $1
         AND esta_activo = true
       ORDER BY descripcion ASC NULLS LAST
       LIMIT 5000`,
      codigoCuenta,
    );

    return rows.map((row) => {
      const titulo = tituloFromMetadatos(row.metadatosCatalogo);
      const nombre = (titulo || row.descripcion || row.sku || '').trim();
      return catalogKey(nombre, row.sku ?? '');
    });
  }
}
