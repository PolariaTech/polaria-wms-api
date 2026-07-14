import { Prisma } from '../../../generated/prisma/client';

type WarehouseStateWithLote = Prisma.WarehouseStateGetPayload<{
  include: { lote: true };
}>;

/** Orden FEFO/FIFO por fecha de vencimiento del lote (frio / ventas). */
export function ordenarWarehouseStateFefo(
  rows: WarehouseStateWithLote[],
): WarehouseStateWithLote[] {
  return [...rows].sort((a, b) => {
    const fa = a.lote?.fechaVencimiento?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const fb = b.lote?.fechaVencimiento?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (fa !== fb) {
      return fa - fb;
    }
    return a.updatedAt.getTime() - b.updatedAt.getTime();
  });
}

export function seleccionarWarehouseStateFefo(
  candidatos: WarehouseStateWithLote[],
): WarehouseStateWithLote | null {
  const ordenados = ordenarWarehouseStateFefo(candidatos);
  return ordenados[0] ?? null;
}
