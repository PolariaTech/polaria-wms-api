import { resolveCentroConsumoSinConfundirConCliente } from './centro-consumo-vs-cliente';

describe('resolveCentroConsumoSinConfundirConCliente', () => {
  it('descarta hotel/marca cuando es igual al cliente', () => {
    expect(
      resolveCentroConsumoSinConfundirConCliente(
        'DREAMS JADE RESORT & SPA',
        'PROMOCIONES MARINA MORELOS / DREAMS JADE RESORT & SPA',
      ),
    ).toBeNull();
  });

  it('descarta cuando centro es solo el nombre del resort', () => {
    expect(
      resolveCentroConsumoSinConfundirConCliente(
        'Dreams Jade Resort & Spa',
        'Dreams Jade Resort & Spa',
      ),
    ).toBeNull();
  });

  it('conserva cocina / área interna aunque mencione el hotel', () => {
    expect(
      resolveCentroConsumoSinConfundirConCliente(
        'Cocina de banquetes Dreams Jade',
        'Dreams Jade Resort & Spa',
      ),
    ).toBe('Cocina de banquetes Dreams Jade');
  });

  it('conserva códigos tipo BAWH Bar Whisky', () => {
    expect(
      resolveCentroConsumoSinConfundirConCliente(
        'BAWH Bar Whisky',
        'Hotel Xcaret México',
      ),
    ).toBe('BAWH Bar Whisky');
  });
});
