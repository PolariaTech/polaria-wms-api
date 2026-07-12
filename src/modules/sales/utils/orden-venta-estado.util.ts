import {
  EstadoOrdenTrabajo,
  EstadoOrdenVenta,
  EstadoTarea,
  Prisma,
} from '../../../generated/prisma/client';

export class OrdenVentaEstadoError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export interface DespachoLineaInput {
  idProducto: string;
  cantidad: Prisma.Decimal;
}

const ESTADOS_PERMITIDOS_DESPACHO: EstadoOrdenVenta[] = [
  EstadoOrdenVenta.confirmada,
  EstadoOrdenVenta.en_preparacion,
  EstadoOrdenVenta.parcialmente_despachada,
];

export async function marcarOvEnPreparacion(
  tx: Prisma.TransactionClient,
  idOrdenVenta: string,
): Promise<void> {
  const orden = await tx.ordenVenta.findUnique({
    where: { idOrdenVenta },
    select: { estado: true },
  });

  if (!orden) {
    throw new OrdenVentaEstadoError('OV_NOT_FOUND');
  }

  if (orden.estado !== EstadoOrdenVenta.confirmada) {
    throw new OrdenVentaEstadoError('OV_ESTADO_INVALIDO');
  }

  await tx.ordenVenta.update({
    where: { idOrdenVenta },
    data: { estado: EstadoOrdenVenta.en_preparacion },
  });
}

export async function cancelarOtsPendientesOv(
  tx: Prisma.TransactionClient,
  idOrdenVenta: string,
  exceptIdOrdenTrabajo?: string,
): Promise<void> {
  const ots = await tx.ordenTrabajo.findMany({
    where: {
      idOrdenVenta,
      estado: {
        in: [EstadoOrdenTrabajo.planificada, EstadoOrdenTrabajo.en_proceso],
      },
      ...(exceptIdOrdenTrabajo
        ? { idOrdenTrabajo: { not: exceptIdOrdenTrabajo } }
        : {}),
    },
    select: { idOrdenTrabajo: true },
  });

  const ids = ots.map((ot) => ot.idOrdenTrabajo);
  if (ids.length === 0) {
    return;
  }

  await tx.ordenTrabajo.updateMany({
    where: { idOrdenTrabajo: { in: ids } },
    data: { estado: EstadoOrdenTrabajo.cancelada },
  });

  await tx.tareaCola.updateMany({
    where: {
      idOrdenTrabajo: { in: ids },
      estado: { in: [EstadoTarea.pendiente, EstadoTarea.en_proceso] },
    },
    data: { estado: EstadoTarea.cancelada },
  });
}

export async function registrarDespachoOv(
  tx: Prisma.TransactionClient,
  idOrdenVenta: string,
  lineasDespachadas: DespachoLineaInput[],
): Promise<EstadoOrdenVenta> {
  const orden = await tx.ordenVenta.findUnique({
    where: { idOrdenVenta },
    include: { lineas: true },
  });

  if (!orden) {
    throw new OrdenVentaEstadoError('OV_NOT_FOUND');
  }

  if (!ESTADOS_PERMITIDOS_DESPACHO.includes(orden.estado)) {
    throw new OrdenVentaEstadoError('OV_ESTADO_INVALIDO');
  }

  const lineasActualizadas = orden.lineas.map((linea) => ({
    cantidadPedida: linea.cantidadPedida,
    cantidadDespachada: linea.cantidadDespachada,
  }));

  for (const despacho of lineasDespachadas) {
    const idx = orden.lineas.findIndex(
      (linea) => linea.idProducto === despacho.idProducto,
    );

    if (idx === -1) {
      throw new OrdenVentaEstadoError('OV_LINEA_NO_ENCONTRADA');
    }

    const linea = orden.lineas[idx]!;
    const nuevaCantidad = linea.cantidadDespachada.add(despacho.cantidad);

    if (nuevaCantidad.gt(linea.cantidadPedida)) {
      throw new OrdenVentaEstadoError('DESPACHO_EXCEDE_PEDIDO');
    }

    await tx.ordenVentaLinea.update({
      where: { idLineaOrdenVenta: linea.idLineaOrdenVenta },
      data: { cantidadDespachada: nuevaCantidad },
    });

    lineasActualizadas[idx] = {
      cantidadPedida: linea.cantidadPedida,
      cantidadDespachada: nuevaCantidad,
    };
  }

  const nuevoEstado = computeEstadoDespacho(lineasActualizadas);

  await tx.ordenVenta.update({
    where: { idOrdenVenta },
    data: { estado: nuevoEstado },
  });

  return nuevoEstado;
}

export function computeEstadoDespacho(
  lineas: Array<{
    cantidadPedida: Prisma.Decimal;
    cantidadDespachada: Prisma.Decimal;
  }>,
): EstadoOrdenVenta {
  const todasCompletas = lineas.every((linea) =>
    linea.cantidadDespachada.gte(linea.cantidadPedida),
  );

  if (todasCompletas) {
    return EstadoOrdenVenta.despachada;
  }

  const algunaDespachada = lineas.some((linea) =>
    linea.cantidadDespachada.gt(0),
  );

  if (algunaDespachada) {
    return EstadoOrdenVenta.parcialmente_despachada;
  }

  return EstadoOrdenVenta.confirmada;
}

export async function esUbicacionZonaSalida(
  tx: Prisma.TransactionClient,
  idUbicacion: string,
): Promise<boolean> {
  const ubicacion = await tx.ubicacion.findUnique({
    where: { idUbicacion },
    include: { tipoUbicacion: { select: { esPicking: true } } },
  });

  return ubicacion?.tipoUbicacion?.esPicking === true;
}
