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
  type ArchivoSubido,
} from '../ai/file-extractors';
import { extraerPedido, type PedidoExtraido } from '../ai/openai-pedido.client';
import { buildTextoOrigenPedido } from '../ai/utils/texto-origen-pedido';
import { stampOrigenCorreoMeta } from '../ai/utils/stamp-origen-correo-meta';
import type { OrigenCorreoRenglon } from '../ai/utils/origen-correo-ordenes-trabajo';

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

  async leerPedido(input: {
    codigoCuenta: string;
    cliente?: string;
    texto: string;
    files: Express.Multer.File[];
    numeroCorreo?: string;
    horario?: string;
    /** Si viene de JWT+tenant; si no, se resuelve por codigoCuenta (API key). */
    ctx?: TenantContext | null;
  }): Promise<PedidoExtraido & { textoOrigen: string | null }> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Falta configurar OPENAI_API_KEY en el servidor para leer pedidos con IA.',
      );
    }

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
    const catalogoClaves = await this.listCatalogoClaves(codigoCuenta, ctx);

    if (catalogoClaves.length === 0) {
      throw new BadRequestException(
        'No hay productos en el catálogo de esta cuenta. Revisa el esquema/tenant o el alta de productos.',
      );
    }

    try {
      const uploaded = this.toArchivosSubidos(input.files);
      const archivosExtraidos = await extractFiles(uploaded);
      const textoOrigen = buildTextoOrigenPedido(texto, archivosExtraidos);
      const hoyISO = new Date().toISOString().slice(0, 10);

      const { pedido, uso } = await extraerPedido({
        texto,
        archivosExtraidos,
        hoyISO,
        catalogoClaves,
        presentaciones: [...PRESENTACIONES],
      });

      const origenCorreo = stampOrigenCorreoMeta(pedido.origenCorreo ?? [], {
        numeroCorreo: input.numeroCorreo,
        horario: input.horario,
      });

      this.logger.log(
        JSON.stringify({
          evento: 'leer-pedido',
          exito: true,
          cliente: input.cliente?.trim() || '(sin cliente)',
          codigoCuenta,
          catalogoProductos: catalogoClaves.length,
          archivos: input.files.length,
          textoOrigenChars: textoOrigen.length,
          duracionMs: Date.now() - inicio,
          tokensTotal: uso?.tokensTotal ?? null,
          costoUSD: uso?.costoUSD ?? null,
        }),
      );

      return {
        ...pedido,
        origenCorreo,
        textoOrigen: textoOrigen || null,
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
      if (
        err instanceof BadRequestException ||
        err instanceof ServiceUnavailableException ||
        err instanceof NotFoundException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      throw err;
    }
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

    const origenArchivos =
      input.origenArchivos?.trim() ||
      (input.files.length > 0
        ? input.files
            .map((f) => f.originalname?.trim())
            .filter(Boolean)
            .join(', ')
        : null);

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
        pick(pedido.telefono, first['Telefono contacto']),
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

  /** Comprador por nombre (IA/correo); null si no hay match claro. */
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
         AND lower(trim(nombre)) = lower(trim($2))
       LIMIT 1`,
      codigoCuenta,
      nombre,
    );
    if (exact[0]?.idComprador) return exact[0].idComprador;

    const tokens = nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 6)
      .sort((a, b) => b.length - a.length);

    for (const tok of tokens.slice(0, 4)) {
      const fuzzy = await this.prisma.$queryRawUnsafe<
        Array<{ idComprador: string }>
      >(
        `SELECT id_comprador AS "idComprador"
         FROM ${schema}.comprador
         WHERE codigo_cuenta = $1
           AND esta_activo = true
           AND (
             lower(nombre) LIKE '%' || $2 || '%'
             OR lower(coalesce(codigo, '')) LIKE '%' || $2 || '%'
           )
         ORDER BY length(nombre) ASC
         LIMIT 1`,
        codigoCuenta,
        tok,
      );
      if (fuzzy[0]?.idComprador) return fuzzy[0].idComprador;
    }

    return null;
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
