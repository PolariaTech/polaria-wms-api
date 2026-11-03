import { extractCorreoRemitenteBirchstreet } from './correo-remitente-birchstreet';

const CUERPO_CORREO = [
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
  'Click the Reply button to send an email to Ixayana Cid',
].join('\n');

const TEXTO_PDF = [
  'CONTACTO: CUNMC_CXP@Hilton.com',
  'Sent From: Hilton CANCUN MAR CARIBE ALL-INCLUSIVE RESORT, MEXICO',
  'Name: Ixayana Cid',
  'Title: Chef de Partie',
  'Phone: 9986892660',
  'Fax:',
  'Email: Ixayana.Cid@Hilton.com',
  'Cost Center:',
].join('\n');

describe('extractCorreoRemitenteBirchstreet (REQ-239)', () => {
  it('toma el correo del bloque «Sent By» del cuerpo', () => {
    expect(extractCorreoRemitenteBirchstreet(CUERPO_CORREO)).toBe(
      'Ixayana.Cid@Hilton.com',
    );
  });

  it('toma el Email del bloque «Sent From» del PDF y no el CONTACTO de facturación', () => {
    expect(extractCorreoRemitenteBirchstreet(TEXTO_PDF)).toBe(
      'Ixayana.Cid@Hilton.com',
    );
  });

  it('con ambos, el cuerpo y el PDF coinciden', () => {
    expect(
      extractCorreoRemitenteBirchstreet(`${CUERPO_CORREO}\n\n${TEXTO_PDF}`),
    ).toBe('Ixayana.Cid@Hilton.com');
  });

  it('ignora el correo genérico de BirchStreet', () => {
    const texto =
      'Sent By:\nbss_system@birchstreet.net\nIxayana.Cid@Hilton.com';
    expect(extractCorreoRemitenteBirchstreet(texto)).toBe(
      'Ixayana.Cid@Hilton.com',
    );
  });

  it('no mira correos lejos de la etiqueta', () => {
    const texto = [
      'Sent By:',
      'Ixayana Cid',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'otro@hotel.com',
    ].join('\n');
    expect(extractCorreoRemitenteBirchstreet(texto)).toBeNull();
  });

  it('devuelve null si el texto no trae el bloque', () => {
    expect(
      extractCorreoRemitenteBirchstreet('CONTACTO: CUNMC_CXP@Hilton.com'),
    ).toBeNull();
    expect(extractCorreoRemitenteBirchstreet('')).toBeNull();
    expect(extractCorreoRemitenteBirchstreet(null)).toBeNull();
  });
});
