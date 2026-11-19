import { quitarContactoDeDireccion } from './quitar-contacto-direccion';

describe('quitarContactoDeDireccion (REQ-332)', () => {
  it('quita Attn y Sent From del Ship To BirchStreet/Waldorf', () => {
    expect(
      quitarContactoDeDireccion(
        'Waldorf Astoria CANCUN, MEXICO, Carr Federal Libre 307, Cancun-Tulum, ROO, 77580,, MX, Attn: Antonio Porras, Sent From: Waldorf Astoria CANCUN, MEXICO',
      ),
    ).toBe(
      'Waldorf Astoria CANCUN, MEXICO, Carr Federal Libre 307, Cancun-Tulum, ROO, 77580, MX',
    );
  });

  it('deja intacta una dirección limpia', () => {
    expect(
      quitarContactoDeDireccion('Av. Kukulcan km 9, Cancún, QR 77500'),
    ).toBe('Av. Kukulcan km 9, Cancún, QR 77500');
  });
});
