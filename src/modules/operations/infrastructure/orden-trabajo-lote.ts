import type { Prisma } from '../../../generated/prisma/client';
import {
  FLUJO_TIPO_OT,
  FLUJO_TIPO_TAREA,
  FLUJO_TITULO,
} from '../../sales/utils/orden-venta-estado.util';
import {
  CONTADOR_CLAVE_ORDEN_TRABAJO,
  formatCodigoOrdenTrabajo,
} from '../constants/operations.constants';
import type { CreateOrdenTrabajoInput } from '../interfaces/operations.interfaces';
import { buildObservacionesFlujo } from '../utils/orden-trabajo-flujo.util';

type SqlClient = Pick<
  Prisma.TransactionClient,
  '$queryRawUnsafe' | '$executeRawUnsafe'
>;

type OtDelLote = {
  input: CreateOrdenTrabajoInput;
  codigo: string;
  idOrdenTrabajo: string;
};

/**
 * Reserva `cantidad` folios de OT seguidos y los devuelve en orden.
 * El folio OT es único por cuenta: un contador nuevo de otra bodega no puede
 * reiniciar en 1 (OT-000001 ya existe y el INSERT revienta con 500), así que
 * el contador nunca baja del mayor folio existente.
 */
export async function reservarFolios(
  tx: SqlClient,
  schema: string,
  codigoCuenta: string,
  idBodega: string,
  cantidad: number,
): Promise<string[]> {
  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(hashtext($1))`,
    `${codigoCuenta}:orden_trabajo`,
  );

  const filas = await tx.$queryRawUnsafe<Array<{ valor: bigint | string }>>(
    `WITH max_existente AS (
       SELECT COALESCE(MAX(
         CASE
           WHEN codigo ~ '^OT-[0-9]+$' THEN substring(codigo from 4)::bigint
           ELSE 0
         END
       ), 0) AS n
       FROM ${schema}.orden_trabajo
       WHERE codigo_cuenta = $1
     )
     INSERT INTO ${schema}.contador (codigo_cuenta, id_bodega, clave, valor)
     VALUES ($1, $2::uuid, $3, (SELECT n + $4::bigint FROM max_existente))
     ON CONFLICT (codigo_cuenta, id_bodega, clave)
     DO UPDATE SET
       valor = GREATEST(
         ${schema}.contador.valor + $4::bigint,
         (SELECT n + $4::bigint FROM max_existente)
       ),
       updated_at = now()
     RETURNING valor`,
    codigoCuenta,
    idBodega,
    CONTADOR_CLAVE_ORDEN_TRABAJO,
    String(cantidad),
  );

  const valor = filas[0]?.valor;
  if (valor == null) {
    throw new Error(`No se pudo obtener contador de OT en ${schema}`);
  }

  const ultimo = typeof valor === 'bigint' ? valor : BigInt(valor);
  return Array.from({ length: cantidad }, (_valor, indice) =>
    formatCodigoOrdenTrabajo(ultimo - BigInt(cantidad - 1 - indice)),
  );
}

/** Todas las OT del lote deben compartir lo que se escribe una sola vez por OV. */
function exigirLoteUniforme(
  inputs: CreateOrdenTrabajoInput[],
  primero: CreateOrdenTrabajoInput,
): void {
  const comparte = (input: CreateOrdenTrabajoInput): boolean =>
    input.codigoCuenta === primero.codigoCuenta &&
    input.idBodega === primero.idBodega &&
    input.tipoFlujo === primero.tipoFlujo &&
    (input.idAsignado ?? null) === (primero.idAsignado ?? null) &&
    (input.idOrdenVenta ?? null) === (primero.idOrdenVenta ?? null) &&
    (input.idUbicacionDestino ?? null) ===
      (primero.idUbicacionDestino ?? null) &&
    input.observaciones === primero.observaciones;

  if (!inputs.every(comparte)) {
    throw new Error('OT_LOTE_NO_UNIFORME');
  }
}

/** Inserta las OT y devuelve el id que la base le dio a cada código. */
async function insertarOrdenes(
  tx: SqlClient,
  schema: string,
  lote: Array<{ input: CreateOrdenTrabajoInput; codigo: string }>,
  primero: CreateOrdenTrabajoInput,
  idSolicitante: string,
): Promise<Map<string, string>> {
  const creadas = await tx.$queryRawUnsafe<
    Array<{ idOrdenTrabajo: string; codigo: string }>
  >(
    `INSERT INTO ${schema}.orden_trabajo (
       codigo_cuenta,
       id_bodega,
       codigo,
       tipo,
       estado,
       id_solicitante,
       id_asignado,
       id_lote,
       id_ubicacion_origen,
       id_ubicacion_destino,
       id_orden_venta,
       observaciones
     )
     SELECT $1::text,
            $2::uuid,
            f.codigo,
            $3::tipo_orden_trabajo,
            'planificada'::estado_orden_trabajo,
            $4::uuid,
            $5::uuid,
            f.id_lote,
            f.id_ubicacion_origen,
            $6::uuid,
            $7::uuid,
            $8::text
     FROM jsonb_to_recordset($9::jsonb)
       AS f(codigo text, id_lote uuid, id_ubicacion_origen uuid)
     RETURNING id_orden_trabajo AS "idOrdenTrabajo", codigo`,
    primero.codigoCuenta,
    primero.idBodega,
    FLUJO_TIPO_OT[primero.tipoFlujo],
    idSolicitante,
    primero.idAsignado ?? null,
    primero.idUbicacionDestino ?? null,
    primero.idOrdenVenta ?? null,
    buildObservacionesFlujo(primero.tipoFlujo, primero.observaciones),
    JSON.stringify(
      lote.map(({ input, codigo }) => ({
        codigo,
        id_lote: input.idLote ?? null,
        id_ubicacion_origen: input.idUbicacionOrigen ?? null,
      })),
    ),
  );

  return new Map(creadas.map((fila) => [fila.codigo, fila.idOrdenTrabajo]));
}

/** Una línea de salida por OT que traiga producto y cantidad. */
async function insertarLineas(
  tx: SqlClient,
  schema: string,
  ordenes: OtDelLote[],
): Promise<void> {
  const lineas = ordenes.flatMap(({ input, idOrdenTrabajo }) =>
    input.idProducto && input.cantidad != null
      ? [
          {
            id_orden_trabajo: idOrdenTrabajo,
            id_producto: input.idProducto,
            id_ubicacion: input.idUbicacionOrigen ?? null,
            cantidad: input.cantidad,
          },
        ]
      : [],
  );
  if (lineas.length === 0) {
    return;
  }

  await tx.$executeRawUnsafe(
    `INSERT INTO ${schema}.orden_trabajo_linea (
       id_orden_trabajo,
       id_producto,
       id_ubicacion,
       tipo_linea,
       cantidad
     )
     SELECT f.id_orden_trabajo,
            f.id_producto,
            f.id_ubicacion,
            'salida'::tipo_linea_ot,
            f.cantidad
     FROM jsonb_to_recordset($1::jsonb)
       AS f(
         id_orden_trabajo uuid,
         id_producto uuid,
         id_ubicacion uuid,
         cantidad numeric
       )`,
    JSON.stringify(lineas),
  );
}

async function insertarTareas(
  tx: SqlClient,
  schema: string,
  ordenes: OtDelLote[],
  primero: CreateOrdenTrabajoInput,
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO ${schema}.tarea_cola (
       codigo_cuenta,
       id_bodega,
       tipo,
       estado,
       id_asignado,
       id_orden_trabajo,
       titulo,
       descripcion
     )
     SELECT $1::text,
            $2::uuid,
            $3::tipo_tarea,
            'pendiente'::estado_tarea,
            $4::uuid,
            f.id_orden_trabajo,
            f.titulo,
            $5::text
     FROM jsonb_to_recordset($6::jsonb)
       AS f(id_orden_trabajo uuid, titulo text)`,
    primero.codigoCuenta,
    primero.idBodega,
    FLUJO_TIPO_TAREA[primero.tipoFlujo],
    primero.idAsignado ?? null,
    primero.observaciones?.trim() || null,
    JSON.stringify(
      ordenes.map(({ codigo, idOrdenTrabajo }) => ({
        id_orden_trabajo: idOrdenTrabajo,
        titulo: `${FLUJO_TITULO[primero.tipoFlujo]} · ${codigo}`,
      })),
    ),
  );
}

/**
 * Crea varias OT de una misma emisión con un número fijo de sentencias
 * (REQ-348): reserva los folios de una vez y hace un INSERT en lote de OT, de
 * líneas y de tareas, en vez de ~7 sentencias por OT. Todas deben compartir
 * cuenta, bodega, flujo, asignado, destino, orden de venta y observaciones.
 * Devuelve los códigos en el orden de `inputs`. No marca la OV en preparación
 * (eso solo lo hace `create`, con `registrarSalidaOv`).
 */
export async function crearLoteOt(
  tx: SqlClient,
  schema: string,
  inputs: CreateOrdenTrabajoInput[],
  idSolicitante: string,
): Promise<string[]> {
  const primero = inputs[0];
  if (!primero) {
    return [];
  }
  exigirLoteUniforme(inputs, primero);

  const folios = await reservarFolios(
    tx,
    schema,
    primero.codigoCuenta,
    primero.idBodega,
    inputs.length,
  );
  const lote = inputs.map((input, indice) => {
    const codigo = folios[indice];
    if (!codigo) {
      throw new Error(`Faltan folios de OT en ${schema}`);
    }
    return { input, codigo };
  });

  const idPorCodigo = await insertarOrdenes(
    tx,
    schema,
    lote,
    primero,
    idSolicitante,
  );
  const ordenes = lote.map(({ input, codigo }) => {
    const idOrdenTrabajo = idPorCodigo.get(codigo);
    if (!idOrdenTrabajo) {
      throw new Error(`No se pudo insertar orden_trabajo en ${schema}`);
    }
    return { input, codigo, idOrdenTrabajo };
  });

  await insertarLineas(tx, schema, ordenes);
  await insertarTareas(tx, schema, ordenes, primero);

  return ordenes.map(({ codigo }) => codigo);
}
