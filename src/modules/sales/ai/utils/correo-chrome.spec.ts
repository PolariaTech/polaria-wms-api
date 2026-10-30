import { extractCorreoContactoDesdeTexto } from './correo-chrome';

describe('extractCorreoContactoDesdeTexto con correos de BirchStreet (REQ-239)', () => {
  it('copia el correo real del remitente y no el CONTACTO de facturación del PDF', () => {
    const texto = [
      'De: bss_system@birchstreet.net',
      'Para: pedidos@aguacatesdepuebla.com',
      'Asunto: PO CUNMC0047780',
      '',
      'Sent By:',
      'Ixayana Cid',
      '',
      'NODEPT',
      'Hilton CANCUN MAR CARIBE ALL-INCLUSIVE RESORT, MEXICO',
      'Ixayana.Cid@Hilton.com',
      '',
      'CONTACTO: CUNMC_CXP@Hilton.com',
    ].join('\n');
    expect(extractCorreoContactoDesdeTexto(texto)).toBe(
      'Ixayana.Cid@Hilton.com',
    );
  });

  it('si el De es una persona, sigue mandando el De', () => {
    const texto =
      'De: Chef Ana <ana@hotel.com>\nSent By:\nOtra Persona\notra@hotel.com';
    expect(extractCorreoContactoDesdeTexto(texto)).toBe('ana@hotel.com');
  });
});
