import { groupOrigenCorreoToOrdenesTrabajo } from './origen-correo-ordenes-trabajo';

describe('groupOrigenCorreoToOrdenesTrabajo (REQ-291)', () => {
  it('deja una sola OT en un pedido con almacén solo en la primera fila', () => {
    const hijas = groupOrigenCorreoToOrdenesTrabajo([
      {
        'Numero pedido': 'MYK-0304509',
        Almacen: 'COM 01-Banquetes-',
        Producto: 'Ajo',
        Cantidad: 1,
      },
      {
        'Numero pedido': 'MYK-0304509',
        Almacen: '',
        Producto: 'Jugo de naranja',
        Cantidad: 5,
      },
      {
        'Numero pedido': 'MYK-0304509',
        Almacen: '',
        Producto: 'Piña',
        Cantidad: 30,
      },
    ]);
    expect(hijas).toHaveLength(1);
    expect(hijas[0]?.renglones).toHaveLength(3);
    expect(hijas[0]?.almacen).toBe('COM 01-Banquetes-');
  });

  it('mantiene dos OT cuando el pedido nombra dos almacenes', () => {
    const hijas = groupOrigenCorreoToOrdenesTrabajo([
      {
        'Numero pedido': 'P-1',
        Almacen: 'Cocina',
        Producto: 'Papaya',
        Cantidad: 1,
      },
      {
        'Numero pedido': 'P-1',
        Almacen: 'Bar',
        Producto: 'Limón',
        Cantidad: 2,
      },
    ]);
    expect(hijas).toHaveLength(2);
  });
});

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
