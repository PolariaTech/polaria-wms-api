import { createHash, randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
import { assertOperationalTenantScope } from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import {
  descargarAdjuntosOv,
  parseOrigenArchivos,
} from '../ai/storage-ov-adjuntos';
import { sumarImportes } from '../ai/utils/checksum-total-documento';
import {
  groupOrigenCorreoToOrdenesTrabajo,
  parseOrigenCorreoJson,
  type OrigenCorreoRenglon,
} from '../ai/utils/origen-correo-ordenes-trabajo';
import { stampOrigenCorreoMeta } from '../ai/utils/stamp-origen-correo-meta';
import {
  interpretarInstruccionChat,
  interpretarInstruccionConReglas,
  type InterpretacionInstruccionChat,
} from '../ai/openai-pedido.client';
import type {
  CorreccionConsultaResponseDto,
  CorreccionIniciadaResponseDto,
  InterpretacionInstruccionResponseDto,
  InterpretarInstruccionBodyDto,
  PropuestaCorreccionCorreoBodyDto,
  PropuestaCorreccionCorreoResponseDto,
} from '../dto/propuesta-correccion-correo.dto';
import { PedidoIaService, type AdvertenciaLectura } from './pedido-ia.service';

const ESTADO_POR_CONFIRMAR = 'por_confirmar';

/** Cuánto se conserva un trabajo terminado para que la web lo recoja. */
const VIGENCIA_TRABAJO_MS = 30 * 60 * 1000;
/** Tope de trabajos en memoria (procesando + terminados) contra un uso desbordado. */
const MAX_TRABAJOS = 200;
/** Tolerancia al comparar el total que el usuario espera con el de los documentos. */
const TOLERANCIA_IMPORTE_ESPERADO = 0.05;

/**
 * Una corrección tarda de decenas de segundos a unos minutos: no puede ser UNA petición
 * HTTP (el proxy de la web corta a los 30 s). El POST crea un trabajo y responde al
 * instante; la web consulta su avance. El almacén es en memoria (una instancia): si el
 * servidor se reinicia el trabajo se pierde y la web pide repetirlo.
 */
interface Trabajo {
  id: string;
  requestId: string;
  idOrdenVenta: string;
  idUsuario: string;
  schemaName: string | null;
  estado: 'procesando' | 'listo' | 'error';
  propuesta?: PropuestaCorreccionCorreoResponseDto;
  error?: unknown;
  creado: number;
}

interface FilaOrdenVenta {
  idOrdenVenta: string;
  codigoCuenta: string;
  /** `orden_venta.id_bodega` es NOT NULL. */
  idBodega: string;
  estado: string;
  origenCorreo: unknown;
  origenArchivos: string | null;
}

function claveRenglon(renglon: OrigenCorreoRenglon): string {
  const norm = (campo: string | number | null | undefined) =>
    String(campo ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  return [
    norm(renglon['Numero pedido']),
    norm(renglon.Almacen),
    norm(renglon.Producto),
    norm(renglon.Cantidad),
  ].join('|');
}

function contar(
  renglones: readonly OrigenCorreoRenglon[],
): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const renglon of renglones) {
    const clave = claveRenglon(renglon);
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  }
  return conteo;
}

/** Cuántos renglones de `conteoOrigen` no están en `conteoReferencia` (multiconjuntos). */
function diferencia(
  conteoOrigen: ReadonlyMap<string, number>,
  conteoReferencia: ReadonlyMap<string, number>,
): number {
  let total = 0;
  for (const [clave, cantidad] of conteoOrigen) {
    total += Math.max(0, cantidad - (conteoReferencia.get(clave) ?? 0));
  }
  return total;
}

/**
 * Propone (sin escribir nada) las OT de una OV `por_confirmar` releyendo sus archivos
 * ORIGINALES (.eml y PDF) con el mismo núcleo que `leer-pedido` (REQ-187). Es la red de
 * seguridad para cuando la lectura inicial dejó la OV incompleta o inconsistente.
 */
@Injectable()
export class OrdenCorreoRelecturaService {
  private readonly logger = new Logger(OrdenCorreoRelecturaService.name);
  private readonly trabajos = new Map<string, Trabajo>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantLocator: TenantSchemaLocator,
    private readonly pedidoIa: PedidoIaService,
  ) {}

  async proponer(
    idOrdenVenta: string,
    body: PropuestaCorreccionCorreoBodyDto,
    ctx: TenantContext,
  ): Promise<PropuestaCorreccionCorreoResponseDto> {
    const inicio = Date.now();

    const orden = await this.validarOrden(idOrdenVenta, body.requestId, ctx);

    // Los paths salen SOLO de `origen_archivos` de esta OV ya autorizada, nunca del body.
    const adjuntos = parseOrigenArchivos(orden.origenArchivos);
    if (adjuntos.length === 0) {
      throw new UnprocessableEntityException({
        message:
          'Esta orden no conserva los archivos originales del correo, así que no se puede releer.',
        error: 'SIN_ADJUNTOS_ORIGINALES',
      });
    }

    const descarga = await descargarAdjuntosOv(adjuntos, orden.codigoCuenta);
    if (descarga.archivos.length === 0) {
      throw new UnprocessableEntityException({
        message: 'No se pudieron leer los archivos originales de la orden.',
        error: 'ADJUNTOS_NO_DISPONIBLES',
      });
    }

    const advertencias: AdvertenciaLectura[] = [];
    if (descarga.excedeTope) {
      advertencias.push({
        codigo: 'ADJUNTOS_EXCEDEN_TOPE',
        detalle:
          'La orden tiene más archivos que el tope: se leyeron solo los primeros.',
      });
    }
    for (const rechazado of descarga.rechazados) {
      advertencias.push({
        codigo: 'ADJUNTO_RECHAZADO',
        documento: rechazado.nombre,
        detalle: `No se leyó el archivo (${rechazado.motivo}).`,
      });
    }

    let lectura: Awaited<ReturnType<PedidoIaService['leerArchivosParaCuenta']>>;
    try {
      lectura = await this.pedidoIa.leerArchivosParaCuenta({
        codigoCuenta: orden.codigoCuenta,
        ctx,
        texto: '',
        archivos: descarga.archivos,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.registrar({
        idOrdenVenta,
        requestId: body.requestId,
        resultado: 'error_proveedor',
        inicio,
      });
      throw new BadGatewayException({
        message: 'No se pudo consultar a la IA. Intenta de nuevo.',
        error: 'PROVEEDOR_IA',
      });
    }
    advertencias.push(...lectura.advertencias);

    // Dos archivos con la misma OC: no se suman en silencio (podrían duplicar cantidades).
    if (lectura.advertencias.some((advertencia) => advertencia.codigo === 'OC_REPETIDA')) {
      this.registrar({
        idOrdenVenta,
        requestId: body.requestId,
        resultado: 'oc_repetida',
        inicio,
      });
      throw new ConflictException({
        message:
          'Dos archivos de la orden traen la misma orden de compra. Revísalos antes de corregir.',
        error: 'OC_REPETIDA',
        documentos: lectura.advertencias
          .filter((advertencia) => advertencia.codigo === 'OC_REPETIDA')
          .map((advertencia) => advertencia.documento),
      });
    }

    // El checksum determinístico manda: si un documento declara su total y no cuadra,
    // no se ofrece una propuesta que el usuario pueda aplicar creyendo que está bien.
    const noCuadran = lectura.documentos.filter(
      (documento) => documento.verificacion.cuadra === false,
    );
    if (noCuadran.length > 0) {
      this.registrar({
        idOrdenVenta,
        requestId: body.requestId,
        resultado: 'no_cuadra',
        inicio,
        documentos: lectura.documentos.length,
      });
      throw new UnprocessableEntityException({
        message:
          'La relectura no coincide con el total de los documentos. No se propone ningún cambio.',
        error: 'RELECTURA_NO_CUADRA',
        documentos: noCuadran.map((documento) => ({
          nombre: documento.nombre,
          totalDocumento: documento.verificacion.totalDocumento,
          importe: documento.verificacion.importe,
        })),
      });
    }

    const antesRenglones = parseOrigenCorreoJson(orden.origenCorreo);
    const primero = antesRenglones[0];
    // Conserva el sello del correo original (número y horario de ingestión).
    const despuesRenglones = stampOrigenCorreoMeta(
      lectura.pedido.origenCorreo,
      {
        numeroCorreo: primero?.['Numero correo'],
        horario: primero?.Horario,
      },
    );

    const otsAntes = groupOrigenCorreoToOrdenesTrabajo(antesRenglones);
    const otsDespues = groupOrigenCorreoToOrdenesTrabajo(despuesRenglones);
    const idsAntes = new Set(otsAntes.map((ot) => ot.id));
    const idsDespues = new Set(otsDespues.map((ot) => ot.id));
    const conteoAntes = contar(antesRenglones);
    const conteoDespues = contar(despuesRenglones);

    const baseHash = createHash('sha256')
      .update(
        JSON.stringify({
          origenCorreo: antesRenglones,
          adjuntos: descarga.descargados
            .map((adjunto) => [adjunto.path, adjunto.bytes])
            .sort((adjuntoA, adjuntoB) =>
              String(adjuntoA[0]).localeCompare(String(adjuntoB[0])),
            ),
        }),
      )
      .digest('hex');

    this.registrar({
      idOrdenVenta,
      requestId: body.requestId,
      resultado: 'propuesta',
      inicio,
      documentos: lectura.documentos.length,
      archivos: descarga.archivos.length,
      renglonesAntes: antesRenglones.length,
      renglonesDespues: despuesRenglones.length,
      importeAntes: sumarImportes(antesRenglones),
      importeDespues: sumarImportes(despuesRenglones),
      tokensTotal: lectura.tokensTotal,
      costoUSD: lectura.costoUSD,
      longitudInstruccion: body.instruccion?.length ?? 0,
    });

    const importeDespues = sumarImportes(despuesRenglones);
    const expectativas = this.compararExpectativas(
      body.expectativas,
      otsDespues.length,
      importeDespues,
      advertencias,
    );

    return {
      requestId: body.requestId,
      propuestaId: randomUUID(),
      baseHash,
      documentos: lectura.documentos.map((documento) => ({ ...documento })),
      ots: otsDespues.map((ot) => ({
        id: ot.id,
        etiqueta: ot.label,
        numeroPedido: ot.numeroPedido,
        almacen: ot.almacen,
        totalCantidad: ot.totalCantidad,
        renglones: ot.renglones as Array<Record<string, unknown>>,
      })),
      resumen: {
        otAntes: otsAntes.length,
        otDespues: otsDespues.length,
        renglonesAntes: antesRenglones.length,
        renglonesDespues: despuesRenglones.length,
        importeAntes: sumarImportes(antesRenglones),
        importeDespues: sumarImportes(despuesRenglones),
      },
      diff: {
        otNuevas: [...idsDespues].filter((id) => !idsAntes.has(id)),
        otEliminadas: [...idsAntes].filter((id) => !idsDespues.has(id)),
        renglonesAgregados: diferencia(conteoDespues, conteoAntes),
        renglonesQuitados: diferencia(conteoAntes, conteoDespues),
      },
      advertencias,
      ...(expectativas ? { expectativas } : {}),
    };
  }

  /**
   * Arranca la corrección en segundo plano y responde al instante. Las validaciones
   * baratas (OV, cuenta, estado, adjuntos) fallan aquí mismo; lo largo corre aparte.
   */
  async iniciar(
    idOrdenVenta: string,
    body: PropuestaCorreccionCorreoBodyDto,
    ctx: TenantContext,
  ): Promise<CorreccionIniciadaResponseDto> {
    this.purgarTrabajos();
    const orden = await this.validarOrden(idOrdenVenta, body.requestId, ctx);
    if (parseOrigenArchivos(orden.origenArchivos).length === 0) {
      throw new UnprocessableEntityException({
        message:
          'Esta orden no conserva los archivos originales del correo, así que no se puede releer.',
        error: 'SIN_ADJUNTOS_ORIGINALES',
      });
    }

    // Doble clic o reintento mientras corre: es el mismo trabajo (cada corrida cuesta tokens).
    for (const existente of this.trabajos.values()) {
      if (
        existente.estado === 'procesando' &&
        existente.idOrdenVenta === idOrdenVenta &&
        existente.idUsuario === ctx.idUsuario
      ) {
        return {
          requestId: existente.requestId,
          jobId: existente.id,
          estado: 'procesando',
        };
      }
    }
    if (this.trabajos.size >= MAX_TRABAJOS) {
      throw new ServiceUnavailableException({
        message: 'Hay demasiadas correcciones en curso. Intenta en un momento.',
        error: 'DEMASIADOS_TRABAJOS',
      });
    }

    const trabajo: Trabajo = {
      id: randomUUID(),
      requestId: body.requestId,
      idOrdenVenta,
      idUsuario: ctx.idUsuario,
      schemaName: ctx.schemaName ?? null,
      estado: 'procesando',
      creado: Date.now(),
    };
    this.trabajos.set(trabajo.id, trabajo);

    void this.proponer(idOrdenVenta, body, ctx)
      .then((propuesta) => {
        trabajo.propuesta = propuesta;
        trabajo.estado = 'listo';
      })
      .catch((error: unknown) => {
        trabajo.error = error;
        trabajo.estado = 'error';
      });

    return {
      requestId: body.requestId,
      jobId: trabajo.id,
      estado: 'procesando',
    };
  }

  /** Avance de un trabajo: solo lo ve quien lo inició, para esa OV. */
  consultar(
    idOrdenVenta: string,
    jobId: string,
    ctx: TenantContext,
  ): CorreccionConsultaResponseDto {
    this.purgarTrabajos();
    const trabajo = this.trabajos.get(jobId);
    if (
      !trabajo ||
      trabajo.idOrdenVenta !== idOrdenVenta ||
      trabajo.idUsuario !== ctx.idUsuario ||
      trabajo.schemaName !== (ctx.schemaName ?? null)
    ) {
      throw new NotFoundException({
        message:
          'No se encontró la corrección: pudo expirar o el servidor se reinició. Vuelve a intentarlo.',
        error: 'TRABAJO_NO_ENCONTRADO',
      });
    }

    if (trabajo.estado === 'procesando') return { estado: 'procesando' };
    if (trabajo.estado === 'listo') {
      return { estado: 'listo', propuesta: trabajo.propuesta };
    }

    // Terminó con error: se entrega una sola vez, con el mismo código HTTP que tendría.
    this.trabajos.delete(trabajo.id);
    if (trabajo.error instanceof HttpException) throw trabajo.error;
    throw new BadGatewayException({
      message: 'No se pudo consultar a la IA. Intenta de nuevo.',
      error: 'PROVEEDOR_IA',
    });
  }

  /**
   * Decide qué función corresponde a lo que escribió el usuario en el chat (mover
   * renglones que ya existen, o releer el correo y los archivos) y qué espera obtener.
   * Si el modelo falla, un respaldo por reglas mantiene el chat funcionando.
   */
  async interpretar(
    idOrdenVenta: string,
    body: InterpretarInstruccionBodyDto,
    ctx: TenantContext,
  ): Promise<InterpretacionInstruccionResponseDto> {
    const inicio = Date.now();
    const orden = await this.validarOrden(idOrdenVenta, body.requestId, ctx);

    const renglones = parseOrigenCorreoJson(orden.origenCorreo);
    const contexto = {
      instruccion: body.instruccion,
      otActuales: groupOrigenCorreoToOrdenesTrabajo(renglones).length,
      renglonesActuales: renglones.length,
      importeActual: sumarImportes(renglones),
      pedidosDistintos: new Set(
        renglones.map((renglon) =>
          (renglon['Numero pedido'] ?? '').toString().trim(),
        ),
      ).size,
      tieneArchivosOriginales:
        parseOrigenArchivos(orden.origenArchivos).length > 0,
    };

    let decision: InterpretacionInstruccionChat;
    let porReglas = false;
    try {
      decision = await interpretarInstruccionChat(contexto);
    } catch {
      decision = interpretarInstruccionConReglas(contexto);
      porReglas = true;
    }

    this.registrar({
      idOrdenVenta,
      requestId: body.requestId,
      resultado: 'interpretacion',
      inicio,
      intencion: decision.intencion,
      porReglas,
      longitudInstruccion: body.instruccion.length,
    });

    return {
      requestId: body.requestId,
      intencion: decision.intencion,
      motivo: decision.motivo,
      expectativas: {
        ...(decision.totalOt !== null ? { totalOt: decision.totalOt } : {}),
        ...(decision.importeTotal !== null
          ? { importeTotal: decision.importeTotal }
          : {}),
      },
      porReglas,
    };
  }

  /** Compara lo que el usuario dijo que esperaba con lo que dicen los documentos. */
  private compararExpectativas(
    esperado: PropuestaCorreccionCorreoBodyDto['expectativas'],
    otResultado: number,
    importeResultado: number,
    advertencias: AdvertenciaLectura[],
  ): PropuestaCorreccionCorreoResponseDto['expectativas'] {
    const totalOtPedido = esperado?.totalOt ?? null;
    const importeTotalPedido = esperado?.importeTotal ?? null;
    if (totalOtPedido === null && importeTotalPedido === null) return undefined;

    const coincideTotalOt =
      totalOtPedido === null ? null : totalOtPedido === otResultado;
    const coincideImporte =
      importeTotalPedido === null
        ? null
        : Math.abs(importeTotalPedido - importeResultado) <=
          TOLERANCIA_IMPORTE_ESPERADO;

    if (coincideTotalOt === false) {
      advertencias.push({
        codigo: 'EXPECTATIVA_OT_DISTINTA',
        detalle: `Pediste ${totalOtPedido} órdenes de trabajo; según los documentos son ${otResultado}. Revisa si falta o sobra alguna.`,
      });
    }
    if (coincideImporte === false) {
      advertencias.push({
        codigo: 'EXPECTATIVA_IMPORTE_DISTINTO',
        detalle: `Esperabas un total de ${importeTotalPedido}; los documentos suman ${importeResultado}.`,
      });
    }

    return {
      totalOtPedido,
      importeTotalPedido,
      totalOtResultado: otResultado,
      importeResultado,
      coincideTotalOt,
      coincideImporte,
    };
  }

  /** OV del tenant, de la cuenta del usuario y todavía por confirmar (o 404/409). */
  private async validarOrden(
    idOrdenVenta: string,
    requestId: string,
    ctx: TenantContext,
  ): Promise<FilaOrdenVenta> {
    const orden = await this.cargarOrden(idOrdenVenta, ctx, requestId);

    // Una OV de otra cuenta responde igual que una inexistente.
    try {
      assertOperationalTenantScope(ctx, {
        codigoCuenta: orden.codigoCuenta,
        idBodega: orden.idBodega,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw this.noEncontrada();
      throw error;
    }

    if (orden.estado !== ESTADO_POR_CONFIRMAR) {
      throw new ConflictException({
        message: 'La orden de venta ya no está por confirmar.',
        error: 'OV_ESTADO_CAMBIO',
      });
    }
    return orden;
  }

  private purgarTrabajos(): void {
    const limite = Date.now() - VIGENCIA_TRABAJO_MS;
    for (const [id, trabajo] of this.trabajos) {
      if (trabajo.estado !== 'procesando' && trabajo.creado < limite) {
        this.trabajos.delete(id);
      }
    }
  }

  /** La OV se carga por id dentro del schema del tenant del JWT. */
  private async cargarOrden(
    idOrdenVenta: string,
    ctx: TenantContext,
    requestId: string,
  ): Promise<FilaOrdenVenta> {
    const schema = this.tenantLocator.assertSafeSchemaIdent(
      ctx.schemaName?.trim() || 'public',
    );
    let filas: FilaOrdenVenta[];
    try {
      filas = await this.prisma.$queryRawUnsafe<FilaOrdenVenta[]>(
        `SELECT id_orden_venta AS "idOrdenVenta",
                codigo_cuenta AS "codigoCuenta",
                id_bodega AS "idBodega",
                estado::text AS estado,
                origen_correo AS "origenCorreo",
                origen_archivos AS "origenArchivos"
         FROM ${schema}.orden_venta
         WHERE id_orden_venta = $1::uuid
         LIMIT 1`,
        idOrdenVenta,
      );
    } catch {
      // Solo metadatos: el error crudo de la base de datos no se registra ni se devuelve.
      this.logger.error(
        JSON.stringify({
          evento: 'correccion_correo_ot',
          resultado: 'error_bd',
          idOrdenVenta,
          requestId,
        }),
      );
      throw new InternalServerErrorException({
        message: 'No se pudo consultar la orden de venta. Intenta de nuevo.',
        error: 'BASE_DATOS',
      });
    }
    const orden = filas[0];
    if (!orden) throw this.noEncontrada();
    return orden;
  }

  private noEncontrada(): NotFoundException {
    return new NotFoundException('No se encontró la orden de venta');
  }

  /** Solo metadatos: nunca texto de los archivos, la instrucción ni la respuesta del modelo. */
  private registrar(datos: {
    idOrdenVenta: string;
    requestId: string;
    resultado: string;
    inicio: number;
    [clave: string]: unknown;
  }): void {
    const { inicio, ...resto } = datos;
    this.logger.log(
      JSON.stringify({
        evento: 'correccion_correo_ot',
        ...resto,
        latenciaMs: Date.now() - inicio,
      }),
    );
  }
}
