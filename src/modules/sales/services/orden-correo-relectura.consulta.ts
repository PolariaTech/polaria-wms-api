import {
  InternalServerErrorException,
  NotFoundException,
  type Logger,
} from '@nestjs/common';
import type { PrismaService } from '../../../core/database/prisma.service';
import { parseOrigenArchivos } from '../ai/storage-ov-adjuntos';
import type { HermanaRelectura } from '../ai/utils/relectura-hermanas';

export interface FilaOrdenVenta {
  idOrdenVenta: string;
  codigoCuenta: string;
  /** `orden_venta.id_bodega` es NOT NULL. */
  idBodega: string;
  estado: string;
  origenCorreo: unknown;
  origenArchivos: string | null;
  ordenCompraHotel: string | null;
}

export function noEncontrada(): NotFoundException {
  return new NotFoundException('No se encontró la orden de venta');
}

/** Solo metadatos: el error crudo de la base de datos no se registra ni se devuelve. */
function errorBaseDatos(
  logger: Logger,
  datos: { idOrdenVenta: string; requestId: string },
): InternalServerErrorException {
  logger.error(
    JSON.stringify({
      evento: 'correccion_correo_ot',
      resultado: 'error_bd',
      ...datos,
    }),
  );
  return new InternalServerErrorException({
    message: 'No se pudo consultar la orden de venta. Intenta de nuevo.',
    error: 'BASE_DATOS',
  });
}

/** La OV se carga por id dentro del schema del tenant del JWT (`schema` ya validado). */
export async function cargarOrden(
  prisma: PrismaService,
  schema: string,
  logger: Logger,
  idOrdenVenta: string,
  requestId: string,
): Promise<FilaOrdenVenta> {
  let filas: FilaOrdenVenta[];
  try {
    filas = await prisma.$queryRawUnsafe<FilaOrdenVenta[]>(
      `SELECT id_orden_venta AS "idOrdenVenta",
                codigo_cuenta AS "codigoCuenta",
                id_bodega AS "idBodega",
                estado::text AS estado,
                origen_correo AS "origenCorreo",
                origen_archivos AS "origenArchivos",
                orden_compra_hotel AS "ordenCompraHotel"
         FROM ${schema}.orden_venta
         WHERE id_orden_venta = $1::uuid
         LIMIT 1`,
      idOrdenVenta,
    );
  } catch {
    throw errorBaseDatos(logger, { idOrdenVenta, requestId });
  }
  const orden = filas[0];
  if (!orden) throw noEncontrada();
  return orden;
}

/**
 * REQ-313: las OV del mismo correo (mismos archivos originales) de la misma cuenta, sin la
 * propia ni las canceladas. Sin ningún adjunto con `path` no hay forma de decir qué es
 * «el mismo correo», así que no se consulta.
 */
export async function cargarHermanasRelectura(
  prisma: PrismaService,
  schema: string,
  logger: Logger,
  datos: {
    idOrdenVenta: string;
    codigoCuenta: string;
    origenArchivos: string | null;
    requestId: string;
  },
): Promise<HermanaRelectura[]> {
  const conPath = parseOrigenArchivos(datos.origenArchivos).some((adjunto) =>
    Boolean(adjunto.path),
  );
  if (!conPath || !datos.origenArchivos) return [];
  try {
    return await prisma.$queryRawUnsafe<HermanaRelectura[]>(
      `SELECT codigo,
                orden_compra_hotel AS "ordenCompra",
                origen_correo AS "origenCorreo"
         FROM ${schema}.orden_venta
         WHERE codigo_cuenta = $1
           AND origen_archivos = $2
           AND id_orden_venta <> $3::uuid
           AND estado::text <> 'cancelada'
         LIMIT 50`,
      datos.codigoCuenta,
      datos.origenArchivos,
      datos.idOrdenVenta,
    );
  } catch {
    throw errorBaseDatos(logger, datos);
  }
}
