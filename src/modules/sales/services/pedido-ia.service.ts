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
