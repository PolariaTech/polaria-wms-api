import {
  extractDireccionCorreoAplicativo,
  resolveDireccionEntregaDesdeTexto,
} from './direccion-correo-aplicativo';

const CORREO_FACTURA_SI = [
  'PEDIDO ADP-261030-0528-06E 路 ORDINARIO',
  'Emisi贸n: 30/10/2026 05:35 hrs',
  'Asesor: Atenci贸n al Cliente',
  '',
  'Cliente: Carnitas Michoac谩n',
  'Tel茅fono: 9988941672',
  'Correo: carnitas.almacen@gmail.com',
  'Recibe: Aurora',
  'Entrega: viernes, 30 de octubre de 2026',
  'Direcci贸n: Av.Nichupte region 96 mz 109 lt 05',
  '',
  'Factura: S铆',
  'RFC: KOEL800411UJ6',
  'Enviar factura a: Promustang1@me.com',
  '',
  'Lista: Restaurantes Canc煤n Centro',
].join('\n');

describe('extractDireccionCorreoAplicativo (REQ-231)', () => {
  it('lee la l铆nea 芦Direcci贸n:禄 del correo del aplicativo', () => {
    expect(extractDireccionCorreoAplicativo(CORREO_FACTURA_SI)).toBe(
      'Av.Nichupte region 96 mz 109 lt 05',
    );
  });

  it('manda sobre un 芦Enviar a:禄 del PDF con el correo de facturaci贸n', () => {
    const conPdf = `${CORREO_FACTURA_SI}\n\n--- Pedido.pdf ---\nEnviar a Promustang1@me.com\nLista de precios: Restaurantes Canc煤n Centro 路 Vigencia del 26 al 31 de octubre de 2026`;
    expect(extractDireccionCorreoAplicativo(conPdf)).toBe(
      'Av.Nichupte region 96 mz 109 lt 05',
    );
  });

  it('conserva direcciones largas con comas', () => {
    const texto = [
      'PEDIDO ADP-261029-1610-P5O 路 ORDINARIO',
      'Direcci贸n: SUSHI CENTRAL 02 SECCION E, AV. BONAMPAK MZA. 27 LT 1 LOCAL 7, PUERTO JUAREZ, ZONA HOTELERA, 77500, CANCUN Q.R.',
      '',
      'Factura: S铆',
    ].join('\n');
    expect(extractDireccionCorreoAplicativo(texto)).toBe(
      'SUSHI CENTRAL 02 SECCION E, AV. BONAMPAK MZA. 27 LT 1 LOCAL 7, PUERTO JUAREZ, ZONA HOTELERA, 77500, CANCUN Q.R.',
    );
  });

  it('devuelve null si el correo no es del aplicativo', () => {
    expect(
      extractDireccionCorreoAplicativo(
        'Pedido Marriott\nDirecci贸n: Calle 1 #2\nPO: 123',
      ),
    ).toBeNull();
  });

  it('devuelve null si la l铆nea Direcci贸n: viene vac铆a', () => {
    expect(
      extractDireccionCorreoAplicativo(
        'PEDIDO ADP-261030-0001-AAA 路 ORDINARIO\nRecibe: Ana\nDirecci贸n:\n\nFactura: No',
      ),
    ).toBeNull();
  });

  it('no toma como direcci贸n un correo electr贸nico', () => {
    expect(
      extractDireccionCorreoAplicativo(
        'PEDIDO ADP-261030-0001-AAA 路 ORDINARIO\nDirecci贸n: facturacion@tallerderestaurantes.com\n',
      ),
    ).toBeNull();
  });
});

describe('resolveDireccionEntregaDesdeTexto (REQ-231)', () => {
  it('usa la l韓ea del aplicativo y, si no es de ese correo, la regla Ship To', () => {
    expect(resolveDireccionEntregaDesdeTexto(CORREO_FACTURA_SI)).toBe(
      'Av.Nichupte region 96 mz 109 lt 05',
    );
    expect(
      resolveDireccionEntregaDesdeTexto(
        'Ship To: Calle Reforma 100, Canc鷑, Q.R.\nBill To: Otra calle',
      ),
    ).toBe('Calle Reforma 100, Canc鷑, Q.R.');
    expect(resolveDireccionEntregaDesdeTexto('sin direcci髇')).toBeNull();
  });
});
