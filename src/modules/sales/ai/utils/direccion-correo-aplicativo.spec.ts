import { extractDireccionCorreoAplicativo } from './direccion-correo-aplicativo';

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
    const conPdf = `${CORREO_FACTURA_SI}\n\n--- Pedido.pdf ---\nEnviar a: Promustang1@me.com\nLista de precios: Restaurantes Cancún Centro · Vigencia del 26 al 31 de octubre de 2026`;
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
