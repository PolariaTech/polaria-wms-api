import { limpiarDireccionEntrega } from './limpiar-direccion-birchstreet';

describe('limpiarDireccionEntrega (REQ-239)', () => {
  it('quita ATTN y FROM que BirchStreet pega al final de la dirección', () => {
    const sucia =
      'Hilton CANCUN MAR CARIBE ALL-INCLUSIVE RESORT, MEXICO, Kukulcan Km 17, Zona Hotelera, CANCUN, ROO, 77500, MX. Attn: Ixayana Cid, Sent From: Hilton CANCUN MAR CARIBE ALL-INCLUSIVE RESORT,';
    expect(limpiarDireccionEntrega(sucia)).toBe(
      'Hilton CANCUN MAR CARIBE ALL-INCLUSIVE RESORT, MEXICO, Kukulcan Km 17, Zona Hotelera, CANCUN, ROO, 77500, MX',
    );
  });

  it('quita ATTN y FROM aunque vengan en líneas separadas', () => {
    const sucia =
      'Kukulcan Km 17, Zona Hotelera\nCANCUN, ROO, 77500, MX\nAttn: Ixayana Cid\nSent From: Hilton CANCUN';
    expect(limpiarDireccionEntrega(sucia)).toBe(
      'Kukulcan Km 17, Zona Hotelera, CANCUN, ROO, 77500, MX',
    );
  });

  it('quita correos, fax y teléfonos', () => {
    expect(
      limpiarDireccionEntrega(
        'Av. Tulum 10, Cancún, Fax: 998 123 4567, Email: chef@hotel.com, Tel 9981234567',
      ),
    ).toBe('Av. Tulum 10, Cancún');
  });

  it('deja intacta una dirección limpia', () => {
    expect(
      limpiarDireccionEntrega('Blvd. Kukulcan km 17, Cancún, Q. Roo'),
    ).toBe('Blvd. Kukulcan km 17, Cancún, Q. Roo');
  });

  it('no confunde la palabra "from" sin dos puntos con la etiqueta', () => {
    expect(limpiarDireccionEntrega('Calle Del Mar 5, Playa del Carmen')).toBe(
      'Calle Del Mar 5, Playa del Carmen',
    );
  });

  it('devuelve null si solo queda contacto o está vacía', () => {
    expect(limpiarDireccionEntrega('Attn: Ixayana Cid')).toBeNull();
    expect(limpiarDireccionEntrega('chef@hotel.com')).toBeNull();
    expect(limpiarDireccionEntrega('')).toBeNull();
    expect(limpiarDireccionEntrega(null)).toBeNull();
  });
});
