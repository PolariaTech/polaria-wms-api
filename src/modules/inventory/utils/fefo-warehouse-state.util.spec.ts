import { seleccionarWarehouseStateFefo } from './fefo-warehouse-state.util';

describe('seleccionarWarehouseStateFefo', () => {
  it('elige el lote con vencimiento más próximo', () => {
    const rows = [
      {
        idWarehouseState: 'b',
        updatedAt: new Date('2026-01-02'),
        lote: { fechaVencimiento: new Date('2026-12-01') },
      },
      {
        idWarehouseState: 'a',
        updatedAt: new Date('2026-01-01'),
        lote: { fechaVencimiento: new Date('2026-06-01') },
      },
    ] as never[];

    const picked = seleccionarWarehouseStateFefo(rows);
    expect(picked?.idWarehouseState).toBe('a');
  });
});
