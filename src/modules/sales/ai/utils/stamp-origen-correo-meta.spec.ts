import {
  formatHorarioIngest,
  stampOrigenCorreoMeta,
} from './stamp-origen-correo-meta';

describe('stampOrigenCorreoMeta', () => {
  it('sella Horario y Numero correo sin borrar entrega', () => {
    const stamped = stampOrigenCorreoMeta(
      [
        {
          Producto: 'AGUACATE',
          Horario: '',
          'Numero correo': '',
          'Ventana desde': '06:00',
          'Direccion entrega': 'Parque Xcaret',
          'Telefono contacto': '984 15157 80',
        },
      ],
      {
        numeroCorreo: '1a118678f75792b1',
        now: new Date('2026-10-07T17:06:26'),
      },
    );

    expect(stamped[0]?.Horario).toBe(formatHorarioIngest(new Date('2026-10-07T17:06:26')));
    expect(stamped[0]?.['Numero correo']).toBe('1a118678f75792b1');
    expect(stamped[0]?.['Ventana desde']).toBe('06:00');
    expect(stamped[0]?.['Direccion entrega']).toBe('Parque Xcaret');
    expect(stamped[0]?.['Telefono contacto']).toBe('984 15157 80');
  });

  it('no pisa Horario / Numero correo ya llenos', () => {
    const stamped = stampOrigenCorreoMeta(
      [
        {
          Horario: '2026-01-01 00:00:00',
          'Numero correo': 'abc',
        },
      ],
      { numeroCorreo: 'zzz', horario: 'ignored' },
    );
    expect(stamped[0]?.Horario).toBe('2026-01-01 00:00:00');
    expect(stamped[0]?.['Numero correo']).toBe('abc');
  });

  it('sin meta no cambia Horario vacío (UI Polaria)', () => {
    const stamped = stampOrigenCorreoMeta(
      [{ Horario: '', 'Numero correo': '', Producto: 'X' }],
      {},
    );
    expect(stamped[0]?.Horario).toBe('');
    expect(stamped[0]?.['Numero correo']).toBe('');
  });
});
