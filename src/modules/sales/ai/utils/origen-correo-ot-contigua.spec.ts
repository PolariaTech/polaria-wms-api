import { groupOrigenCorreoToOrdenesTrabajo } from './origen-correo-ordenes-trabajo';
import { contiguousOtIdsForRenglones } from './origen-correo-ot-contigua';

describe('origen-correo-ot-contigua (REQ-238)', () => {
  it('misma cocina que reaparece tras otra = 3 OT', () => {
    const hijas = groupOrigenCorreoToOrdenesTrabajo([
      {
        'Numero pedido': 'PO-1',
        Almacen: 'Cocina 1',
        Producto: 'Sandía',
        Cantidad: 5,
      },
      {
        'Numero pedido': 'PO-1',
        Almacen: 'Cocina 2',
        Producto: 'Papa',
        Cantidad: 5,
      },
      {
        'Numero pedido': 'PO-1',
        Almacen: 'Cocina 1',
        Producto: 'Papaya',
        Cantidad: 5,
      },
    ]);
    expect(hijas).toHaveLength(3);
    expect(hijas[0]?.renglones.map((r) => r.Producto)).toEqual(['Sandía']);
    expect(hijas[2]?.renglones.map((r) => r.Producto)).toEqual(['Papaya']);
  });

  it('bloque contiguo permanece en la misma OT', () => {
    const ids = contiguousOtIdsForRenglones([
      { Almacen: 'Cocina 1', Producto: 'A', Cantidad: 1 },
      { Almacen: 'Cocina 1', Producto: 'B', Cantidad: 1 },
    ]);
    expect(ids[0]).toBe(ids[1]);
  });
});
