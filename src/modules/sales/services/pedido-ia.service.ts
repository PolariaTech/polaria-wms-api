import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { PrismaService } from '../../../core/database/prisma.service';
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
    ctx: TenantContext;
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

    const inicio = Date.now();
    const catalogoClaves = await this.listCatalogoClaves(
      codigoCuenta,
      input.ctx,
    );

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
      if (err instanceof BadRequestException || err instanceof ServiceUnavailableException) {
        throw err;
      }
      throw err;
    }
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

  /** Claves EXACTAS para el prompt OpenAI: "NOMBRE (SKU)". */
  private async listCatalogoClaves(
    codigoCuenta: string,
    ctx: TenantContext,
  ): Promise<string[]> {
    return this.prisma.runWithSchema(ctx.schemaName, async () => {
      const rows = await this.prisma.producto.findMany({
        where: {
          codigoCuenta,
          estaActivo: true,
        },
        select: {
          sku: true,
          descripcion: true,
          metadatosCatalogo: true,
        },
        take: 5000,
      });

      return rows.map((row) => {
        const titulo = tituloFromMetadatos(row.metadatosCatalogo);
        const nombre = (titulo || row.descripcion || row.sku).trim();
        return catalogKey(nombre, row.sku);
      });
    });
  }
}
