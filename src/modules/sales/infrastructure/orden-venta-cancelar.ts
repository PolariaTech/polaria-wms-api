import { Prisma } from '../../../generated/prisma/client';
import { liberarReservaOv } from './orden-venta-reserva';

type SqlClient = Pick<
  Prisma.TransactionClient,
  '$queryRawUnsafe' | '$executeRawUnsafe'
>;

/**
 * REQ-350: dentro de la TX ya con search_path — libera reserva y cancela OT/tareas.
 * El caller debe haber marcado la OV como `cancelada` (lock por estado).
 */
export async function cancelarOvSideEffects(
  tx: SqlClient,
  schema: string,
  orden: { idOrdenVenta: string; codigoCuenta: string; idBodega: string },
  idUsuario: string,
): Promise<void> {
  await liberarReservaOv(tx, schema, orden, idUsuario);

  await tx.$executeRawUnsafe(
    `UPDATE ${schema}.orden_trabajo
     SET estado = 'cancelada',
         updated_at = now()
     WHERE id_orden_venta = $1::uuid
       AND estado IN ('planificada', 'en_proceso')`,
    orden.idOrdenVenta,
  );

  await tx.$executeRawUnsafe(
    `UPDATE ${schema}.tarea_cola
     SET estado = 'cancelada',
         updated_at = now()
     WHERE id_orden_trabajo IN (
       SELECT id_orden_trabajo
       FROM ${schema}.orden_trabajo
       WHERE id_orden_venta = $1::uuid
     )
       AND estado IN ('pendiente', 'en_proceso')`,
    orden.idOrdenVenta,
  );
}
