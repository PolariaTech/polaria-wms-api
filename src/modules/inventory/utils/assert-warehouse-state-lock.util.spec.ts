import { assertWarehouseStateLockForMove } from './assert-warehouse-state-lock.util';
import { LOCK_STALE_MS } from '../constants/inventory.constants';

describe('assertWarehouseStateLockForMove', () => {
  const idUsuario = 'usr-operario';

  it('rechaza movimiento sin lock activo', () => {
    expect(() =>
      assertWarehouseStateLockForMove(
        { lockedBy: null, lockedAt: null },
        idUsuario,
      ),
    ).toThrow('LOCK_REQUIRED');
  });

  it('permite movimiento cuando el operario tiene el lock', () => {
    expect(() =>
      assertWarehouseStateLockForMove(
        { lockedBy: idUsuario, lockedAt: new Date() },
        idUsuario,
      ),
    ).not.toThrow();
  });

  it('rechaza movimiento si otro operario tiene lock activo', () => {
    expect(() =>
      assertWarehouseStateLockForMove(
        { lockedBy: 'otro-operario', lockedAt: new Date() },
        idUsuario,
      ),
    ).toThrow('LOCK_HELD_BY_OTHER');
  });

  it('permite movimiento sobre lock stale de otro operario', () => {
    const staleAt = new Date(Date.now() - LOCK_STALE_MS - 1_000);

    expect(() =>
      assertWarehouseStateLockForMove(
        { lockedBy: 'otro-operario', lockedAt: staleAt },
        idUsuario,
      ),
    ).not.toThrow();
  });
});
