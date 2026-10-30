import {
  detectOrdenCompraFromSource,
  normalizeNumeroPedidoFields,
  ocDesdeNombreArchivo,
  resolveOrdenCompraLimpia,
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

  it('detecta REQUISICION # (XPU HA / hotel)', () => {
    expect(
      detectOrdenCompraFromSource(
        'Requisición de Compra\nREQUISICION # 50184\nAutoriza: JGA 170819',
      ),
    ).toBe('50184');
  });

  it('NO toma el Artículo tras el título Requisición de Compra', () => {
    const pdfLike = [
      'XPU HA MANAGEMENT S DE RL DE CV',
      'Requisición de Compra',
      'Fecha Requisición 2026/10/25',
      'REQUISICION # 50179',
      'Departamento CBEEFE/BEEF BAR',
      'Articulo Descripcion Solicita Autoriza',
      '00001678 AGUACATE HASS PARA DECORACION PREMIU 0.50 0.50',
    ].join('\n');
    expect(detectOrdenCompraFromSource(pdfLike)).toBe('50179');
  });

  it('detecta número ANTES del rótulo (orden unpdf XPU HA)', () => {
    const unpdfLike =
      '50179REQUISICION #\nR.C AGUACATE PREMIUM BEEF BAR\nN Requisición de Compra\n00001678 AGUACATE HASS';
    expect(detectOrdenCompraFromSource(unpdfLike)).toBe('50179');
  });
});

describe('normalizeNumeroPedidoFields — requisición vs basura OCR', () => {
  it('reemplaza rAutorizado por REQUISICION # del PDF', () => {
    const { ordenCompraHotel } = normalizeNumeroPedidoFields({
      ordenCompraHotel: 'rAutorizado',
      lineas: [{ numeroPedido: 'rAutorizado', almacen: 'CBEEFB BEEF BAR' }],
      sourceText:
        'XPU HA MANAGEMENT\nREQUISICION # 50179\nDepartamento: CBEEFE BEEF BAR\nAutoriza: JGA 170808',
      fileNames: ['R.C Aguacate BB.pdf'],
    });
    expect(ordenCompraHotel).toBe('50179');
  });

  it('reemplaza Artículo 00001678 por REQUISICION # 50179', () => {
    const source = [
      'Requisición de Compra',
      'REQUISICION # 50179',
      'Articulo 00001678 AGUACATE HASS',
    ].join('\n');
    expect(resolveOrdenCompraLimpia('00001678', source)).toBe('50179');
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

describe('OC por documento (REQ-187)', () => {
  describe('ocDesdeNombreArchivo', () => {
    it('lee la OC incrustada en el nombre (no solo al inicio)', () => {
      expect(
        ocDesdeNombreArchivo(
          'AGUACATES DE PUEBLA_4502987208_UNICO FAC NOV.pdf',
        ),
      ).toBe('4502987208');
    });

    it('también dentro de un adjunto de .eml (correo.eml → archivo.pdf)', () => {
      expect(
        ocDesdeNombreArchivo(
          'correo.eml → AGUACATES DE PUEBLA_4502986931_HRV.pdf',
        ),
      ).toBe('4502986931');
    });

    it('conserva el caso del número al inicio del nombre', () => {
      expect(ocDesdeNombreArchivo('4501056534_PEDIDO.pdf')).toBe('4501056534');
    });

    it('no confunde fechas de 8 dígitos con una OC', () => {
      expect(ocDesdeNombreArchivo('factura_20261029.pdf')).toBeNull();
    });

    it('null si el nombre no trae número', () => {
      expect(ocDesdeNombreArchivo('correo.eml')).toBeNull();
    });
  });
});
