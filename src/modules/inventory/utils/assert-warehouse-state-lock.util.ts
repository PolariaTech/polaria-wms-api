import { LOCK_STALE_MS } from '../constants/inventory.constants';

interface WarehouseStateLockRow {
  lockedBy: string | null;
  lockedAt: Date | null;
}

/** POL-104: el operario debe tener el lock activo antes de mover stock. */
export function assertWarehouseStateLockForMove(
  ws: WarehouseStateLockRow,
  idUsuario: string,
): void {
  if (!ws.lockedBy) {
    throw new Error('LOCK_REQUIRED');
  }

  if (ws.lockedBy === idUsuario) {
    return;
  }

  if (ws.lockedAt && Date.now() - ws.lockedAt.getTime() > LOCK_STALE_MS) {
    return;
  }

  throw new Error('LOCK_HELD_BY_OTHER');
}
