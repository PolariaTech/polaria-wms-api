import { groupOrigenCorreoToOrdenesTrabajo } from './origen-correo-ordenes-trabajo';

describe('groupOrigenCorreoToOrdenesTrabajo (REQ-238)', () => {
  it('no mezcla productos de la misma cocina si hay otra en medio', () => {
    const hijas = groupOrigenCorreoToOrdenesTrabajo([
      { Almacen: 'Cocina 1', Producto: 'A', Cantidad: 1, 'Numero pedido': '1' },
      { Almacen: 'Cocina 2', Producto: 'B', Cantidad: 1, 'Numero pedido': '1' },
      { Almacen: 'Cocina 1', Producto: 'C', Cantidad: 1, 'Numero pedido': '1' },
    ]);
    expect(hijas).toHaveLength(3);
  });
});
