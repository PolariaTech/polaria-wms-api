import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
import {
  appendSeguimientoArchivo,
  nombreArchivoSeguimiento,
  parseOrigenArchivosLista,
  serializeOrigenArchivosLista,
} from '../ai/utils/append-seguimiento-archivo';
import { uploadOvAdjuntoBuffer } from '../ai/upload-ov-adjunto-cloudinary';
import { recordOrdenVentaAudit } from '../utils/record-orden-venta-audit';

type OrdenSeguimientoRow = {
  idOrdenVenta: string;
  codigo: string;
  origenArchivos: string | null;
};

@Injectable()
export class RegistrarSeguimientoService {
  private readonly logger = new Logger(RegistrarSeguimientoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantLocator: TenantSchemaLocator,
  ) {}

  /**
   * Cuelga un .eml de seguimiento en una OV ya creada.
   * No crea orden, no llama a la IA y no toca origen_texto ni origen_correo.
   */
  async registrarSeguimiento(input: {
    codigoCuenta: string;
    ordenCompra?: string;
    codigo?: string;
    numeroCorreo?: string;
    files: Express.Multer.File[];
  }): Promise<{
    idOrdenVenta: string;
    codigo: string;
    nombre: string;
    path: string;
    agregado: boolean;
  }> {
    const codigoCuenta = input.codigoCuenta.trim();
    const ordenCompra = (input.ordenCompra ?? '').trim();
    const codigo = (input.codigo ?? '').trim();
    if (!codigoCuenta) {
      throw new BadRequestException('Falta codigoCuenta.');
    }
    if (!ordenCompra && !codigo) {
      throw new BadRequestException(
        'Indica la orden de compra o el código de la OV.',
      );
    }

    const eml = pickEmlSeguimiento(input.files);
    if (!eml) {
      throw new BadRequestException('Falta el archivo .eml de seguimiento.');
    }

    const ctx = await this.buildIntegrationTenantContext(codigoCuenta);
    const schema = this.tenantLocator.assertSafeSchemaIdent(
      ctx.schemaName?.trim() || 'public',
    );

    let matches: OrdenSeguimientoRow[];
    try {
      matches = await this.prisma.$queryRawUnsafe<OrdenSeguimientoRow[]>(
        `SELECT id_orden_venta AS "idOrdenVenta",
                codigo,
                origen_archivos AS "origenArchivos"
         FROM ${schema}.orden_venta
         WHERE codigo_cuenta = $1
           AND estado <> 'cancelada'
           AND ($2 = '' OR lower(trim(coalesce(orden_compra_hotel, ''))) = lower(trim($2)))
           AND ($3 = '' OR lower(trim(codigo)) = lower(trim($3)))
         ORDER BY created_at DESC
         LIMIT 5`,
        codigoCuenta,
        ordenCompra,
        codigo,
      );
    } catch (err) {
      this.registrarFallo(
        codigoCuenta,
        err,
        'No se pudo consultar la orden de venta.',
      );
    }

    if (matches.length === 0) {
      throw new NotFoundException(
        'No hay una orden de venta activa con ese número.',
      );
    }
    if (matches.length > 1 && !codigo) {
      throw new ConflictException(
        `Hay ${matches.length} órdenes con esa compra (${matches
          .map((row) => row.codigo)
          .join(', ')}). Envía el código de la OV.`,
      );
    }

    const orden = matches[0]!;
    const idSeguimiento =
      (input.numeroCorreo ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40) ||
      randomUUID().replace(/-/g, '').slice(0, 12);
    const nombre = nombreArchivoSeguimiento(idSeguimiento);
    const existentes = parseOrigenArchivosLista(orden.origenArchivos);
    const previo = existentes.find(
      (item) => item.nombre.trim().toLowerCase() === nombre.toLowerCase(),
    );
    if (previo) {
      return {
        idOrdenVenta: orden.idOrdenVenta,
        codigo: orden.codigo,
        nombre,
        path: previo.path ?? '',
        agregado: false,
      };
    }

    const uploaded = await uploadOvAdjuntoBuffer({
      buffer: eml.buffer,
      originalname: nombre,
      mimetype: eml.mimetype || 'message/rfc822',
      size: eml.size,
      codigoCuenta,
    });
    if (!uploaded.ok) {
      throw new ServiceUnavailableException(uploaded.message);
    }

    const merged = appendSeguimientoArchivo(existentes, {
      nombre: uploaded.adjunto.nombre,
      url: uploaded.adjunto.url,
      path: uploaded.adjunto.path,
      mime: uploaded.adjunto.mime,
      bytes: uploaded.adjunto.bytes,
      resourceType: uploaded.adjunto.resourceType,
    });

    let updated = 0;
    try {
      updated = await this.prisma.$executeRawUnsafe(
        `UPDATE ${schema}.orden_venta
         SET origen_archivos = $1,
             updated_at = now()
         WHERE id_orden_venta = $2::uuid
           AND codigo_cuenta = $3`,
        serializeOrigenArchivosLista(merged.items),
        orden.idOrdenVenta,
        codigoCuenta,
      );
    } catch (err) {
      this.registrarFallo(
        codigoCuenta,
        err,
        'No se pudo guardar el seguimiento en la orden.',
      );
    }
    if (updated === 0) {
      throw new NotFoundException(
        'No hay una orden de venta activa con ese número.',
      );
    }

    await recordOrdenVentaAudit(this.prisma, {
      schemaName: schema,
      codigoCuenta,
      idOrdenVenta: orden.idOrdenVenta,
      accion: 'actualizacion',
      mensaje: `Se agregó el correo de seguimiento ${nombre}.`,
      autorNombre: 'Mateo / bot',
      payloadExtra: {
        tipo: 'registrar_seguimiento',
        nombre,
        path: uploaded.adjunto.path,
      },
    });

    this.logger.log(
      JSON.stringify({
        evento: 'registrar-seguimiento',
        exito: true,
        codigoCuenta,
        idOrdenVenta: orden.idOrdenVenta,
        codigo: orden.codigo,
        nombre,
      }),
    );

    return {
      idOrdenVenta: orden.idOrdenVenta,
      codigo: orden.codigo,
      nombre: uploaded.adjunto.nombre,
      path: uploaded.adjunto.path,
      agregado: merged.agregado,
    };
  }

  private registrarFallo(
    codigoCuenta: string,
    err: unknown,
    mensaje: string,
  ): never {
    const error = err instanceof Error ? err.message : String(err);
    this.logger.error(
      JSON.stringify({
        evento: 'registrar-seguimiento',
        exito: false,
        codigoCuenta,
        error,
      }),
    );
    throw new ServiceUnavailableException(mensaje);
  }

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
}

function pickEmlSeguimiento(
  files: Express.Multer.File[],
): Express.Multer.File | null {
  for (const file of files) {
    const name = (file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (
      name.endsWith('.eml') ||
      mime.includes('message/rfc822') ||
      mime === 'application/eml'
    ) {
      return file;
    }
  }
  return null;
}
