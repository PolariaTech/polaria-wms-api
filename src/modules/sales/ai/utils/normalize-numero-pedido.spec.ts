import {
  detectOrdenCompraFromSource,
  normalizeNumeroPedidoFields,
  shouldUnifyNumeroPedidoToOc,
} from './normalize-numero-pedido';
import { groupOrigenCorreoToOrdenesTrabajo } from './origen-correo-ordenes-trabajo';

describe('detectOrdenCompraFromSource', () => {
  it('prioriza el número del nombre del PDF', () => {
    expect(
      detectOrdenCompraFromSource('sin oc en texto', [
        '4501056534_AGUACATES 27.08.2026.pdf',
      ]),
    ).toBe('4501056534');
  });

  it('detecta Oc Generada repetida en tabla', () => {
    const text = Array.from({ length: 10 })
      .map(() => 'CROSSDOCK KG 1 4501056534')
      .join('\n');
    expect(detectOrdenCompraFromSource(text)).toBe('4501056534');
  });
});

describe('normalizeNumeroPedidoFields — caso Xcaret', () => {
  const xcaretLineas = [
    {
      numeroPedido: 'Almacen',
      almacen: 'Almacen General',
    },
    {
      numeroPedido: '3672322',
      almacen: 'Ayb Xc Producción De Banquetes',
    },
    {
      numeroPedido: '3672303',
      almacen: 'Ayb Rest Veracruz',
    },
    {
      numeroPedido: '3672301',
      almacen: 'Panadería Ayb',
    },
    {
      numeroPedido: '3672276',
      almacen: 'Ayb Xc Cena Gran Tlachco',
    },
    {
      numeroPedido: '3672237',
      almacen: 'Ayb Xp Restaurant Troglodita',
    },
    {
      numeroPedido: '3672216',
      almacen: 'Ayb Xp Restaurant Troglodita',
    },
    {
      numeroPedido: '3672186',
      almacen: 'Ayb Xp Restaurant Troglodita',
    },
    {
      numeroPedido: '3672236',
      almacen: 'Ayb Xc Restaurant Jalisco',
    },
    {
      numeroPedido: '3672093',
      almacen: 'Ayb Xc Restaurant Baja California',
    },
    {
      numeroPedido: '3672091',
      almacen: 'Ayb Xc Restaurant Oaxaca',
    },
  ];

  it('unifica Usuario→Oc Generada y deja 9 OTs al agrupar', () => {
    const sourceText = Array.from({ length: 31 })
      .map(() => 'Oc Generada 4501056534')
      .join('\n');

    const { ordenCompraHotel, lineas } = normalizeNumeroPedidoFields({
      ordenCompraHotel: '3672091',
      lineas: xcaretLineas,
      sourceText,
      fileNames: ['4501056534_AGUACATES 27.08.2026.pdf'],
    });

    expect(ordenCompraHotel).toBe('4501056534');
    expect(lineas.every((l) => l.numeroPedido === '4501056534')).toBe(true);

    const hijas = groupOrigenCorreoToOrdenesTrabajo(
      lineas.map((l) => ({
        'Numero pedido': l.numeroPedido ?? '',
        Almacen: l.almacen ?? '',
        Producto: 'X',
        Cantidad: 1,
      })),
    );
    expect(hijas).toHaveLength(9);
  });

  it('shouldUnify es true cuando hay varios Usuario por almacén', () => {
    expect(shouldUnifyNumeroPedidoToOc(xcaretLineas, '4501056534')).toBe(true);
  });
});

describe('normalizeNumeroPedidoFields — no rompe Marina', () => {
  it('conserva POs distintos reales por destino', () => {
    const lineas = [
      { numeroPedido: '387529', almacen: 'COCINA PRINCIPAL' },
      { numeroPedido: '387529', almacen: 'COCINA PRINCIPAL' },
      { numeroPedido: '387531', almacen: 'COCINA PRINCIPAL' },
      { numeroPedido: '387537', almacen: 'COCINA PRINCIPAL' },
    ];
    const { ordenCompraHotel, lineas: out } = normalizeNumeroPedidoFields({
      ordenCompraHotel: null,
      lineas,
      sourceText: 'Numero pedido 387529\nNumero pedido 387531\nNumero pedido 387537',
      fileNames: ['pedido-marina.pdf'],
    });
    expect(ordenCompraHotel).toBeNull();
    expect(out.map((l) => l.numeroPedido)).toEqual([
      '387529',
      '387529',
      '387531',
      '387537',
    ]);
  });
});

describe('normalizeNumeroPedidoFields — AVA mismo PO', () => {
  it('no altera cuando ya viene la Oc correcta', () => {
    const lineas = [
      { numeroPedido: '4502949779', almacen: 'BAWH Bar Whisky' },
      { numeroPedido: '4502949779', almacen: 'COPM Coc Plaza Mx' },
    ];
    const { ordenCompraHotel, lineas: out } = normalizeNumeroPedidoFields({
      ordenCompraHotel: '4502949779',
      lineas,
      sourceText: 'Oc Generada 4502949779\nOc Generada 4502949779',
      fileNames: ['4502949779_AVA.pdf'],
    });
    expect(ordenCompraHotel).toBe('4502949779');
    expect(out.every((l) => l.numeroPedido === '4502949779')).toBe(true);
  });
});
