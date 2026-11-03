import { limpiarNotasBirchstreet } from './notas-birchstreet';

const ORIGEN_BIRCHSTREET = 'De: bss_system@birchstreet.net\nPO CUNMC0047780';
const ORIGEN_OTRO = 'De: compras@hotel.com\nPedido de fruta';

describe('limpiarNotasBirchstreet (REQ-239)', () => {
  it('quita los horarios y deja la nota del cliente', () => {
    const notas =
      'Horario de recepción: lunes a viernes de 8:00 AM a 2:00 PM; sábados de 8:00 AM a 12:00 PM. Pedido parcial no aceptado.';
    expect(limpiarNotasBirchstreet(notas, ORIGEN_BIRCHSTREET)).toBe(
      'Pedido parcial no aceptado.',
    );
  });

  it('quita correos, dirección de entrega y nombres de contacto', () => {
    const notas = [
      'Contacto: Ixayana Cid',
      'Favor de enviar a ixayana.cid@hilton.com',
      'Dirección de entrega: Kukulcan Km 17, Cancún',
      'Fruta de primera, sin golpes.',
    ].join('\n');
    expect(limpiarNotasBirchstreet(notas, ORIGEN_BIRCHSTREET)).toBe(
      'Fruta de primera, sin golpes.',
    );
  });

  it('devuelve vacío si todo era horario o contacto', () => {
    expect(
      limpiarNotasBirchstreet(
        'Horario de recepción: 8:00 AM a 2:00 PM.',
        ORIGEN_BIRCHSTREET,
      ),
    ).toBe('');
  });

  it('no toca las notas de correos que no son de BirchStreet', () => {
    const notas = 'Entregar a las 6:00 am. Fruta madura.';
    expect(limpiarNotasBirchstreet(notas, ORIGEN_OTRO)).toBe(notas);
  });

  it('tolera valores vacíos', () => {
    expect(limpiarNotasBirchstreet(null, ORIGEN_BIRCHSTREET)).toBe('');
    expect(limpiarNotasBirchstreet(undefined, ORIGEN_BIRCHSTREET)).toBe('');
    expect(limpiarNotasBirchstreet('  ', ORIGEN_BIRCHSTREET)).toBe('');
  });
});
