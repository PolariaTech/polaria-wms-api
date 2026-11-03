import {
  aplicarIdPedidoAplicativo,
  extractDireccionCorreoAplicativo,
  extractIdPedidoAplicativo,
  resolveDireccionEntrega,
  resolveDireccionEntregaDesdeTexto,
} from './direccion-correo-aplicativo';

const CORREO_FACTURA_SI = [
  'PEDIDO ADP-261030-0528-06E · ORDINARIO',
  'Emisión: 30/10/2026 05:35 hrs',
  'Asesor: Atención al Cliente',
  '',
  'Cliente: Carnitas Michoacán',
  'Teléfono: 9988941672',
  'Correo: carnitas.almacen@gmail.com',
  'Recibe: Aurora',
  'Entrega: viernes, 30 de octubre de 2026',
  'Dirección: Av.Nichupte region 96 mz 109 lt 05',
  '',
  'Factura: Sí',
  'RFC: KOEL800411UJ6',
  'Enviar factura a: Promustang1@me.com',
  '',
  'Lista: Restaurantes Cancún Centro',
].join('\n');

describe('extractDireccionCorreoAplicativo (REQ-231)', () => {
  it('lee la línea «Dirección:» del correo del aplicativo', () => {
    expect(extractDireccionCorreoAplicativo(CORREO_FACTURA_SI)).toBe(
      'Av.Nichupte region 96 mz 109 lt 05',
    );
  });

  it('manda sobre un «Enviar a:» del PDF con el correo de facturación', () => {
    const conPdf = `${CORREO_FACTURA_SI}\n\n--- Pedido.pdf ---\nEnviar a Promustang1@me.com\nLista de precios: Restaurantes Cancún Centro · Vigencia del 26 al 31 de octubre de 2026`;
    expect(extractDireccionCorreoAplicativo(conPdf)).toBe(
      'Av.Nichupte region 96 mz 109 lt 05',
    );
  });

  it('conserva direcciones largas con comas', () => {
    const texto = [
      'PEDIDO ADP-261029-1610-P5O · ORDINARIO',
      'Dirección: SUSHI CENTRAL 02 SECCION E, AV. BONAMPAK MZA. 27 LT 1 LOCAL 7, PUERTO JUAREZ, ZONA HOTELERA, 77500, CANCUN Q.R.',
      '',
      'Factura: Sí',
    ].join('\n');
    expect(extractDireccionCorreoAplicativo(texto)).toBe(
      'SUSHI CENTRAL 02 SECCION E, AV. BONAMPAK MZA. 27 LT 1 LOCAL 7, PUERTO JUAREZ, ZONA HOTELERA, 77500, CANCUN Q.R.',
    );
  });

  it('devuelve null si el correo no es del aplicativo', () => {
    expect(
      extractDireccionCorreoAplicativo(
        'Pedido Marriott\nDirección: Calle 1 #2\nPO: 123',
      ),
    ).toBeNull();
  });

  it('devuelve null si la línea Dirección: viene vacía', () => {
    expect(
      extractDireccionCorreoAplicativo(
        'PEDIDO ADP-261030-0001-AAA · ORDINARIO\nRecibe: Ana\nDirección:\n\nFactura: No',
      ),
    ).toBeNull();
  });

  it('no toma como dirección un correo electrónico', () => {
    expect(
      extractDireccionCorreoAplicativo(
        'PEDIDO ADP-261030-0001-AAA · ORDINARIO\nDirección: facturacion@tallerderestaurantes.com\n',
      ),
    ).toBeNull();
  });
});

describe('ID del pedido del aplicativo (REQ-231, punto 6)', () => {
  it('lee el ID ADP-… del encabezado del correo', () => {
    expect(extractIdPedidoAplicativo(CORREO_FACTURA_SI)).toBe(
      'ADP-261030-0528-06E',
    );
    expect(
      extractIdPedidoAplicativo('PEDIDO ADP-261030-1245-2WF · EXTRAORDINARIO'),
    ).toBe('ADP-261030-1245-2WF');
  });

  it('no inventa ID en correos de otros formatos', () => {
    expect(extractIdPedidoAplicativo('PO NUMBER 4501056534')).toBeNull();
    expect(extractIdPedidoAplicativo(null)).toBeNull();
  });

  it('completa la OC y los renglones que el modelo dejó vacíos', () => {
    const resultado = aplicarIdPedidoAplicativo(
      {
        ordenCompraHotel: null,
        lineas: [{ numeroPedido: null }, { numeroPedido: '' }],
      },
      CORREO_FACTURA_SI,
    );
    expect(resultado.ordenCompraHotel).toBe('ADP-261030-0528-06E');
    expect(resultado.lineas.map((l) => l.numeroPedido)).toEqual([
      'ADP-261030-0528-06E',
      'ADP-261030-0528-06E',
    ]);
  });

  it('corrige un número equivocado del modelo y deja igual lo que no es del aplicativo', () => {
    expect(
      aplicarIdPedidoAplicativo(
        { ordenCompraHotel: '9999', lineas: [{ numeroPedido: '9999' }] },
        CORREO_FACTURA_SI,
      ).lineas[0]?.numeroPedido,
    ).toBe('ADP-261030-0528-06E');

    const original = {
      ordenCompraHotel: '4501056534',
      lineas: [{ numeroPedido: '4501056534' }],
    };
    expect(aplicarIdPedidoAplicativo(original, 'Pedido Xcaret')).toEqual(
      original,
    );
  });
});

describe('resolveDireccionEntregaDesdeTexto (REQ-231)', () => {
  it('usa la línea del aplicativo y, si no es de ese correo, la regla Ship To', () => {
    expect(resolveDireccionEntregaDesdeTexto(CORREO_FACTURA_SI)).toBe(
      'Av.Nichupte region 96 mz 109 lt 05',
    );
    expect(
      resolveDireccionEntregaDesdeTexto(
        'Ship To: Calle Reforma 100, Cancún, Q.R.\nBill To: Otra calle',
      ),
    ).toBe('Calle Reforma 100, Cancún, Q.R.');
    expect(resolveDireccionEntregaDesdeTexto('sin dirección')).toBeNull();
  });
});

describe('resolveDireccionEntrega (REQ-239)', () => {
  it('quita ATTN y FROM del Ship To de BirchStreet', () => {
    const texto = [
      'Bill To: OPERADORA RR CARIBBEAN SA DE CV',
      'Ship To: Hilton CANCUN MAR CARIBE ALL-INCLUSIVE RESORT, MEXICO',
      'Kukulcan Km 17, Zona Hotelera',
      'CANCUN, ROO, 77500, MX',
      'Attn: Ixayana Cid',
      'Sent From: Hilton CANCUN MAR CARIBE ALL-INCLUSIVE RESORT, MEXICO',
      'Name: Ixayana Cid',
    ].join('\n');
    expect(resolveDireccionEntrega(texto, null)).toBe(
      'Hilton CANCUN MAR CARIBE ALL-INCLUSIVE RESORT, MEXICO, Kukulcan Km 17, Zona Hotelera, CANCUN, ROO, 77500, MX',
    );
  });

  it('limpia también la dirección que leyó el modelo cuando el texto no trae Ship To', () => {
    expect(
      resolveDireccionEntrega(
        'sin etiqueta',
        'Kukulcan Km 17, CANCUN, MX. Attn: Ixayana Cid, Sent From: Hilton,',
      ),
    ).toBe('Kukulcan Km 17, CANCUN, MX');
  });

  it('no deja pasar un correo como dirección', () => {
    expect(resolveDireccionEntrega('sin etiqueta', 'chef@hotel.com')).toBeNull();
  });
});
