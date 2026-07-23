import { EstadoSlot } from '../../../generated/prisma/client';
import { syncUbicacionEstadoSlot } from './sync-ubicacion-estado-slot.util';

describe('syncUbicacionEstadoSlot', () => {
  const idUbicacion = '550e8400-e29b-41d4-a716-446655440099';

  function createTx(stockActivo: number) {
    const update = jest.fn().mockResolvedValue(undefined);
    const tx = {
      warehouseState: {
        count: jest.fn().mockResolvedValue(stockActivo),
      },
      ubicacion: { update },
    };
    return { tx, update };
  }

  it('marca ubicación como ocupada cuando hay stock activo', async () => {
    const { tx, update } = createTx(2);

    await syncUbicacionEstadoSlot(tx as never, idUbicacion);

    expect(tx.warehouseState.count).toHaveBeenCalledWith({
      where: { idUbicacion, cantidad: { gt: 0 } },
    });
    expect(update).toHaveBeenCalledWith({
      where: { idUbicacion },
      data: { estadoSlot: EstadoSlot.ocupado },
    });
  });

  it('marca ubicación como libre cuando no hay stock activo', async () => {
    const { tx, update } = createTx(0);

    await syncUbicacionEstadoSlot(tx as never, idUbicacion);

    expect(update).toHaveBeenCalledWith({
      where: { idUbicacion },
      data: { estadoSlot: EstadoSlot.libre },
    });
  });
});
