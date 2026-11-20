import { Prisma } from '../../../generated/prisma/client';
import { TIPO_REFERENCIA_ORDEN_VENTA } from '../constants/orden-venta.constants';
import type { StockAllocation } from '../interfaces/orden-venta.interfaces';
import { asignarFifo } from '../utils/fifo-reserva';
import type { FilaStockFifo } from '../utils/fifo-reserva';

type SqlClient = Pick<
  Prisma.TransactionClient,
  '$queryRawUnsafe' | '$executeRawUnsafe'
>;

/** Lo que `reservarStock` necesita de la OV. */
export type OrdenAReservar = {
  idOrdenVenta: string;
  codigoCuenta: string;
  idBodega: string;
  lineas: Array<{
    idProducto: string;
    cantidadPedida: Prisma.Decimal | string | number;
  }>;
};

/** Stock de los productos de la OV, en el orden FIFO (vencimiento y `updated_at`). */
async function leerStockFifo(
  tx: SqlClient,
  schema: string,
  orden: OrdenAReservar,
  idsProducto: string[],
): Promise<FilaStockFifo[]> {
  return tx.$queryRawUnsafe<FilaStockFifo[]>(
    `SELECT ws.id_warehouse_state AS "idWarehouseState",
            ws.id_ubicacion AS "idUbicacion",
            ws.id_lote AS "idLote",
            ws.id_producto AS "idProducto",
            ws.cantidad,
            ws.cantidad_reservada AS "cantidadReservada",
            l.fecha_vencimiento AS "fechaVencimiento"
     FROM ${schema}.warehouse_state ws
     JOIN ${schema}.ubicacion u ON u.id_ubicacion = ws.id_ubicacion
     JOIN ${schema}.tipo_ubicacion t
       ON t.id_tipo_ubicacion = u.id_tipo_ubicacion
     LEFT JOIN ${schema}.lote l ON l.id_lote = ws.id_lote
     WHERE ws.codigo_cuenta = $1
       AND ws.id_bodega = $2::uuid
       AND ws.id_producto IN (
         SELECT (jsonb_array_elements_text($3::jsonb))::uuid
       )
       AND u.esta_activa = true
       AND t.es_almacenamiento = true
     ORDER BY l.fecha_vencimiento ASC NULLS LAST, ws.updated_at ASC`,
    orden.codigoCuenta,
    orden.idBodega,
    JSON.stringify(idsProducto),
  );
}

/**
 * Suma lo reservado por fila de stock (una fila puede salir en varias
 * asignaciones) y lo aplica con un solo UPDATE. El trigger de warehouse_state
 * fija version = version + 1 por UPDATE, así que la versión sube una vez por
 * fila y emisión.
 */
async function actualizarReservado(
  tx: SqlClient,
  schema: string,
  asignaciones: StockAllocation[],
): Promise<void> {
  const reservadoPorFila = new Map<string, Prisma.Decimal>();
  for (const asignacion of asignaciones) {
    const previo =
      reservadoPorFila.get(asignacion.idWarehouseState) ??
      new Prisma.Decimal(0);
    reservadoPorFila.set(
      asignacion.idWarehouseState,
      previo.add(asignacion.cantidad),
    );
  }

  await tx.$executeRawUnsafe(
    `UPDATE ${schema}.warehouse_state ws
     SET cantidad_reservada = ws.cantidad_reservada + r.cantidad,
         version = ws.version + 1,
         updated_at = now()
     FROM jsonb_to_recordset($1::jsonb)
       AS r(id_warehouse_state uuid, cantidad numeric)
     WHERE ws.id_warehouse_state = r.id_warehouse_state`,
    JSON.stringify(
      [...reservadoPorFila].map(([idWarehouseState, cantidad]) => ({
        id_warehouse_state: idWarehouseState,
        cantidad: cantidad.toString(),
      })),
    ),
  );
}

async function registrarMovimientos(
  tx: SqlClient,
  schema: string,
  orden: OrdenAReservar,
  idUsuario: string,
  asignaciones: StockAllocation[],
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO ${schema}.movimiento_inventario (
       codigo_cuenta,
       id_bodega,
       id_ubicacion_origen,
       id_ubicacion_destino,
       id_producto,
       id_lote,
       cantidad,
       tipo_movimiento,
       id_usuario,
       id_referencia,
       tipo_referencia
     )
     SELECT $1::text,
            $2::uuid,
            m.id_ubicacion,
            m.id_ubicacion,
            m.id_producto,
            m.id_lote,
            m.cantidad,
            'reserva'::tipo_movimiento,
            $3::uuid,
            $4::uuid,
            $5::text
     FROM jsonb_to_recordset($6::jsonb)
       AS m(id_ubicacion uuid, id_producto uuid, id_lote uuid, cantidad numeric)`,
    orden.codigoCuenta,
    orden.idBodega,
    idUsuario,
    orden.idOrdenVenta,
    TIPO_REFERENCIA_ORDEN_VENTA,
    JSON.stringify(
      asignaciones.map((asignacion) => ({
        id_ubicacion: asignacion.idUbicacion,
        id_producto: asignacion.idProducto,
        id_lote: asignacion.idLote,
        cantidad: asignacion.cantidad,
      })),
    ),
  );
}

/**
 * Reserva el stock FIFO de todas las líneas de la OV con un número fijo de
 * sentencias (REQ-348): una lectura, un UPDATE y un INSERT de movimientos,
 * salgan las asignaciones que salgan. El reparto se calcula en memoria con
 * `asignarFifo`. Los parámetros van como JSON para no depender del enlace de
 * arreglos del adaptador. Devuelve las asignaciones, en el orden de las líneas.
 */
export async function reservarStock(
  tx: SqlClient,
  schema: string,
  orden: OrdenAReservar,
  idUsuario: string,
): Promise<StockAllocation[]> {
  const idsProducto = [
    ...new Set(orden.lineas.map((linea) => linea.idProducto)),
  ];
  if (idsProducto.length === 0) {
    return [];
  }

  const filas = await leerStockFifo(tx, schema, orden, idsProducto);
  const asignaciones = asignarFifo(
    filas,
    orden.lineas.map((linea) => ({
      idProducto: linea.idProducto,
      cantidad: new Prisma.Decimal(linea.cantidadPedida),
    })),
  );

  // Temporal: si falta stock, se emite igual con la reserva parcial (o sin reserva).
  if (asignaciones.length > 0) {
    await actualizarReservado(tx, schema, asignaciones);
    await registrarMovimientos(tx, schema, orden, idUsuario, asignaciones);
  }

  return asignaciones;
}

type FilaReservaNet = {
  idWarehouseState: string;
  idUbicacion: string;
  idProducto: string;
  idLote: string | null;
  cantidad: Prisma.Decimal;
};

/**
 * REQ-350: revierte la reserva de stock de una OV (movimientos `reserva` netos
 * menos `liberacion_reserva`), baja `cantidad_reservada` y registra liberaciones.
 */
export async function liberarReservaOv(
  tx: SqlClient,
  schema: string,
  orden: Pick<OrdenAReservar, 'idOrdenVenta' | 'codigoCuenta' | 'idBodega'>,
  idUsuario: string,
): Promise<void> {
  const filas = await tx.$queryRawUnsafe<FilaReservaNet[]>(
    `WITH movs AS (
       SELECT m.id_ubicacion,
              m.id_producto,
              m.id_lote,
              SUM(
                CASE
                  WHEN m.tipo_movimiento = 'reserva'::tipo_movimiento THEN m.cantidad
                  WHEN m.tipo_movimiento = 'liberacion_reserva'::tipo_movimiento THEN -m.cantidad
                  ELSE 0
                END
              ) AS cantidad
       FROM ${schema}.movimiento_inventario m
       WHERE m.codigo_cuenta = $1
         AND m.id_referencia = $2::uuid
         AND m.tipo_referencia = $3
         AND m.tipo_movimiento IN (
           'reserva'::tipo_movimiento,
           'liberacion_reserva'::tipo_movimiento
         )
       GROUP BY m.id_ubicacion, m.id_producto, m.id_lote
       HAVING SUM(
         CASE
           WHEN m.tipo_movimiento = 'reserva'::tipo_movimiento THEN m.cantidad
           WHEN m.tipo_movimiento = 'liberacion_reserva'::tipo_movimiento THEN -m.cantidad
           ELSE 0
         END
       ) > 0
     )
     SELECT ws.id_warehouse_state AS "idWarehouseState",
            movs.id_ubicacion AS "idUbicacion",
            movs.id_producto AS "idProducto",
            movs.id_lote AS "idLote",
            movs.cantidad
     FROM movs
     JOIN ${schema}.warehouse_state ws
       ON ws.codigo_cuenta = $1
      AND ws.id_bodega = $4::uuid
      AND ws.id_ubicacion = movs.id_ubicacion
      AND ws.id_producto = movs.id_producto
      AND ws.id_lote IS NOT DISTINCT FROM movs.id_lote`,
    orden.codigoCuenta,
    orden.idOrdenVenta,
    TIPO_REFERENCIA_ORDEN_VENTA,
    orden.idBodega,
  );

  if (filas.length === 0) return;

  const asignaciones: StockAllocation[] = filas.map((fila) => ({
    idWarehouseState: fila.idWarehouseState,
    idUbicacion: fila.idUbicacion,
    idProducto: fila.idProducto,
    idLote: fila.idLote,
    cantidad: Number(fila.cantidad),
  }));

  await tx.$executeRawUnsafe(
    `UPDATE ${schema}.warehouse_state ws
     SET cantidad_reservada = GREATEST(0, ws.cantidad_reservada - r.cantidad),
         version = ws.version + 1,
         updated_at = now()
     FROM jsonb_to_recordset($1::jsonb)
       AS r(id_warehouse_state uuid, cantidad numeric)
     WHERE ws.id_warehouse_state = r.id_warehouse_state`,
    JSON.stringify(
      asignaciones.map((asignacion) => ({
        id_warehouse_state: asignacion.idWarehouseState,
        cantidad: String(asignacion.cantidad),
      })),
    ),
  );

  await tx.$executeRawUnsafe(
    `INSERT INTO ${schema}.movimiento_inventario (
       codigo_cuenta,
       id_bodega,
       id_ubicacion_origen,
       id_ubicacion_destino,
       id_producto,
       id_lote,
       cantidad,
       tipo_movimiento,
       id_usuario,
       id_referencia,
       tipo_referencia
     )
     SELECT $1::text,
            $2::uuid,
            m.id_ubicacion,
            m.id_ubicacion,
            m.id_producto,
            m.id_lote,
            m.cantidad,
            'liberacion_reserva'::tipo_movimiento,
            $3::uuid,
            $4::uuid,
            $5::text
     FROM jsonb_to_recordset($6::jsonb)
       AS m(id_ubicacion uuid, id_producto uuid, id_lote uuid, cantidad numeric)`,
    orden.codigoCuenta,
    orden.idBodega,
    idUsuario,
    orden.idOrdenVenta,
    TIPO_REFERENCIA_ORDEN_VENTA,
    JSON.stringify(
      asignaciones.map((asignacion) => ({
        id_ubicacion: asignacion.idUbicacion,
        id_producto: asignacion.idProducto,
        id_lote: asignacion.idLote,
        cantidad: String(asignacion.cantidad),
      })),
    ),
  );
}
