import { Prisma } from '../../../generated/prisma/client';

type LineaConCantidad = { cantidad: Prisma.Decimal };

/** Cantidad a transferir según líneas de OT; null = mover todo el warehouse_state (legacy). */
export function resolveCantidadAMover(
  lineas: LineaConCantidad[],
): Prisma.Decimal | null {
  if (lineas.length === 0) {
    return null;
  }

  return lineas.reduce(
    (sum, linea) => sum.add(linea.cantidad),
    new Prisma.Decimal(0),
  );
}
