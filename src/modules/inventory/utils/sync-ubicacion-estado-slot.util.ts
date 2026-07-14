import { EstadoSlot, Prisma } from '../../../generated/prisma/client';

/** Sincroniza `ubicacion.estado_slot` según stock activo en `warehouse_state` (POL-103). */
export async function syncUbicacionEstadoSlot(
  tx: Prisma.TransactionClient,
  idUbicacion: string,
): Promise<void> {
  const stockActivo = await tx.warehouseState.count({
    where: {
      idUbicacion,
      cantidad: { gt: 0 },
    },
  });

  await tx.ubicacion.update({
    where: { idUbicacion },
    data: {
      estadoSlot: stockActivo > 0 ? EstadoSlot.ocupado : EstadoSlot.libre,
    },
  });
}
