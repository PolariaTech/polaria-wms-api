import {
  ordenarWarehouseStateFefo,
  seleccionarWarehouseStateFefo,
} from './fefo-warehouse-state.util';

describe('fefo-warehouse-state.util', () => {
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

  it('desempata por updatedAt ASC cuando la fecha de vencimiento coincide', () => {
    const fecha = new Date('2026-06-01');
    const rows = [
      {
        idWarehouseState: 'nuevo',
        updatedAt: new Date('2026-03-01'),
        lote: { fechaVencimiento: fecha },
      },
      {
        idWarehouseState: 'antiguo',
        updatedAt: new Date('2026-01-01'),
        lote: { fechaVencimiento: fecha },
      },
    ] as never[];

    expect(seleccionarWarehouseStateFefo(rows)?.idWarehouseState).toBe(
      'antiguo',
    );
  });

  it('prioriza lotes con fecha de vencimiento sobre lotes sin fecha', () => {
    const rows = [
      {
        idWarehouseState: 'sin-fecha',
        updatedAt: new Date('2026-01-01'),
        lote: null,
      },
      {
        idWarehouseState: 'con-fecha',
        updatedAt: new Date('2026-02-01'),
        lote: { fechaVencimiento: new Date('2026-12-01') },
      },
    ] as never[];

    expect(seleccionarWarehouseStateFefo(rows)?.idWarehouseState).toBe(
      'con-fecha',
    );
  });

  it('retorna null cuando no hay candidatos', () => {
    expect(seleccionarWarehouseStateFefo([])).toBeNull();
  });

  it('ordenarWarehouseStateFefo no muta el arreglo original', () => {
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

    const ordenados = ordenarWarehouseStateFefo(rows);
    expect(ordenados[0]?.idWarehouseState).toBe('a');
    expect(rows[0]?.idWarehouseState).toBe('b');
  });
});
