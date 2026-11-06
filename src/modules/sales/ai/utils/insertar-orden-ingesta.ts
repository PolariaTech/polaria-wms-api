import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PedidoExtraido } from '../openai-pedido.client';
import type { OrigenCorreoRenglon } from './origen-correo-ordenes-trabajo';
import { sanitizeTelefonoContactoOrNull } from './sanitize-telefono-contacto';

const INSERT_ORDEN_VENTA = `INSERT INTO $SCHEMA.orden_venta (
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
RETURNING id_orden_venta AS "idOrdenVenta", codigo`;

export interface OrdenIngestada {
  idOrdenVenta: string;
  codigo: string;
}

export interface InsertarOrdenIngesta {
  schema: string;
  codigoCuenta: string;
  idBodega: string;
  idCliente: string;
  idComprador: string | null;
  origenArchivos: string | null;
  pedido: PedidoExtraido & { textoOrigen?: string | null };
  origenCorreo: OrigenCorreoRenglon[];
}

type Consulta = <T>(consulta: string, ...valores: unknown[]) => Promise<T>;

function primero(...valores: Array<string | null | undefined>): string | null {
  for (const valor of valores) {
    const limpio = (valor ?? '').trim();
    if (limpio) return limpio;
  }
  return null;
}

function fechaEntregaDe(
  pedido: PedidoExtraido,
  primeroRenglon: OrigenCorreoRenglon,
): string | null {
  const cruda = primero(pedido.fechaEntrega, primeroRenglon.Fecha);
  if (cruda && /^\d{4}-\d{2}-\d{2}/.test(cruda)) return cruda.slice(0, 10);
  return cruda;
}

function valoresDeOrden(
  entrada: InsertarOrdenIngesta,
  primeroRenglon: OrigenCorreoRenglon,
): unknown[] {
  const pedido = entrada.pedido;
  return [
    entrada.codigoCuenta,
    entrada.idBodega,
    entrada.idCliente,
    entrada.idComprador,
    JSON.stringify(entrada.origenCorreo),
    pedido.textoOrigen ?? null,
    entrada.origenArchivos,
    primero(pedido.ordenCompraHotel, primeroRenglon['Numero pedido']),
    primero(pedido.centroConsumo, primeroRenglon.Almacen),
    primero(pedido.contacto, primeroRenglon['Responsable externo']),
    fechaEntregaDe(pedido, primeroRenglon),
    primero(pedido.horarioDesde, primeroRenglon['Ventana desde']),
    primero(pedido.horarioHasta, primeroRenglon['Ventana hasta']),
    primero(
      pedido.direccion,
      primeroRenglon['Direccion entrega'],
      primeroRenglon.Destino,
    ),
    primero(pedido.anden, primeroRenglon.Anden),
    sanitizeTelefonoContactoOrNull(
      primero(pedido.telefono, primeroRenglon['Telefono contacto']),
    ),
    primero(pedido.observaciones, primeroRenglon['Notas generales']),
    primero(primeroRenglon.Prioridad),
  ];
}

export async function insertarOrdenIngestada(
  consultar: Consulta,
  entrada: InsertarOrdenIngesta,
): Promise<OrdenIngestada> {
  const primeroRenglon = entrada.origenCorreo[0];
  if (!primeroRenglon) {
    throw new BadRequestException(
      'No se encontraron productos con cantidades en el correo ni en sus adjuntos, por eso no se creó la OV.',
    );
  }
  try {
    const filas = await consultar<OrdenIngestada[]>(
      INSERT_ORDEN_VENTA.replace('$SCHEMA', entrada.schema),
      ...valoresDeOrden(entrada, primeroRenglon),
    );
    const creada = filas[0];
    if (!creada) {
      throw new ServiceUnavailableException(
        'No se pudo crear la orden de venta.',
      );
    }
    return creada;
  } catch (error) {
    if (error instanceof HttpException) throw error;
    const mensaje = error instanceof Error ? error.message : String(error);
    if (/cliente .* no pertenece/i.test(mensaje)) {
      throw new BadRequestException(
        'No se pudo asignar un cliente de catálogo a la OV. Revisa que la cuenta tenga al menos un cliente activo.',
      );
    }
    throw new BadRequestException(
      `No se pudo crear la OV: ${mensaje.slice(0, 240)}`,
    );
  }
}
