import { Prisma } from '../../../generated/prisma/client';
import type { StockAllocation } from '../interfaces/orden-venta.interfaces';

/** Fila de stock tal como la lee la consulta FIFO de `emitir`. */
export type FilaStockFifo = {
  idWarehouseState: string;
  idUbicacion: string;
  idLote: string | null;
  idProducto: string;
  cantidad: Prisma.Decimal | string | number;
  cantidadReservada: Prisma.Decimal | string | number;
  fechaVencimiento: Date | string | null;
};

export type LineaFifo = { idProducto: string; cantidad: Prisma.Decimal };

type Candidata = {
  fila: FilaStockFifo;
  /** Posición que traía de la consulta (vencimiento y `updated_at` ascendentes). */
  orden: number;
  reservado: Prisma.Decimal;
  tocada: boolean;
};

function aDecimal(valor: Prisma.Decimal | string | number): Prisma.Decimal {
  return new Prisma.Decimal(valor);
}

function vencimiento(candidata: Candidata): number | null {
  const fecha = candidata.fila.fechaVencimiento;
  return fecha == null ? null : new Date(fecha).getTime();
}

function comparar(primera: Candidata, segunda: Candidata): number {
  const venceLaPrimera = vencimiento(primera);
  const venceLaSegunda = vencimiento(segunda);
  if (venceLaPrimera !== venceLaSegunda) {
    if (venceLaPrimera === null) return 1;
    if (venceLaSegunda === null) return -1;
    return venceLaPrimera - venceLaSegunda;
  }
  // Reservar actualiza `updated_at = now()`, así que una fila ya usada pasa
  // detrás de las que no se han tocado en su mismo grupo de vencimiento.
  return (
    Number(primera.tocada) - Number(segunda.tocada) ||
    primera.orden - segunda.orden
  );
}

/**
 * Reparte el stock entre las líneas de una OV, en memoria y en el orden de las
 * líneas, con el mismo resultado que el bucle que antes consultaba y actualizaba
 * la base línea por línea (REQ-348): FIFO por vencimiento, una fila ya reservada
 * pasa al final de su grupo y lo que ya se asignó no se vuelve a ofrecer. Si
 * falta stock, la línea queda con la reserva parcial (o sin reserva).
 *
 * `filas` llega ordenada por vencimiento (sin fecha al final) y `updated_at`.
 */
export function asignarFifo(
  filas: FilaStockFifo[],
  lineas: LineaFifo[],
): StockAllocation[] {
  const porProducto = new Map<string, Candidata[]>();
  filas.forEach((fila, orden) => {
    const lista = porProducto.get(fila.idProducto) ?? [];
    lista.push({
      fila,
      orden,
      reservado: new Prisma.Decimal(0),
      tocada: false,
    });
    porProducto.set(fila.idProducto, lista);
  });

  const asignaciones: StockAllocation[] = [];

  for (const linea of lineas) {
    const candidatas = [...(porProducto.get(linea.idProducto) ?? [])].sort(
      comparar,
    );
    let restante = linea.cantidad;

    for (const candidata of candidatas) {
      const disponible = aDecimal(candidata.fila.cantidad)
        .sub(aDecimal(candidata.fila.cantidadReservada))
        .sub(candidata.reservado);
      if (disponible.lte(0)) {
        continue;
      }

      const tomar = disponible.lte(restante) ? disponible : restante;
      if (tomar.lte(0)) {
        continue;
      }

      asignaciones.push({
        idWarehouseState: candidata.fila.idWarehouseState,
        idUbicacion: candidata.fila.idUbicacion,
        idLote: candidata.fila.idLote,
        idProducto: candidata.fila.idProducto,
        cantidad: tomar.toNumber(),
      });

      candidata.reservado = candidata.reservado.add(tomar);
      candidata.tocada = true;
      restante = restante.sub(tomar);
      if (restante.lte(0)) {
        break;
      }
    }
  }

  return asignaciones;
}
