import {
  claveDeFila,
  claveDeValor,
  claveDia,
  claveHorario,
  claveOc,
  horarioDeFila,
  valorVisible,
} from './claves-division';

describe('claves-division (REQ-262)', () => {
  it('la OC se compara sin espacios sobrantes ni mayúsculas', () => {
    expect(claveOc('  oc  12 ')).toBe('OC 12');
    expect(claveOc(4502988065)).toBe('4502988065');
    expect(claveOc(null)).toBe('');
  });

  it('el día se reduce a AAAA-MM-DD cuando la fecha lo trae', () => {
    expect(claveDia('2026-11-07')).toBe('2026-11-07');
    expect(claveDia('2026-11-07T08:00:00')).toBe('2026-11-07');
    expect(claveDia(' sábado ')).toBe('SÁBADO');
    expect(claveDia(undefined)).toBe('');
  });

  it('el horario sale de la ventana desde-hasta y, sin ella, del texto Horario', () => {
    expect(
      horarioDeFila({ 'Ventana desde': '06:00', 'Ventana hasta': '08:00' }),
    ).toBe('06:00 - 08:00');
    expect(horarioDeFila({ 'Ventana desde': '06:00' })).toBe('06:00');
    expect(horarioDeFila({ Horario: ' Mañana ' })).toBe('Mañana');
    expect(horarioDeFila({})).toBe('');
    expect(claveHorario('06:00 - 08:00')).toBe('06:00 - 08:00');
  });

  it('la clave de una fila depende del criterio', () => {
    const fila = {
      'Numero pedido': 'oc-1',
      Fecha: '2026-11-07',
      'Ventana desde': '06:00',
      'Ventana hasta': '08:00',
    };

    expect(claveDeFila('oc', fila)).toBe('OC-1');
    expect(claveDeFila('dia', fila)).toBe('2026-11-07');
    expect(claveDeFila('horario', fila)).toBe('06:00 - 08:00');
    expect(claveDeFila('dia', {})).toBe('');
  });

  it('el valor que nombra el modelo se normaliza igual que el de la fila', () => {
    expect(claveDeValor('oc', ' oc-1 ')).toBe('OC-1');
    expect(claveDeValor('dia', '2026-11-07')).toBe('2026-11-07');
    expect(claveDeValor('horario', '06:00 - 08:00')).toBe('06:00 - 08:00');
  });

  it('lo que se muestra al operador conserva el texto original salvo el día', () => {
    expect(valorVisible('oc', ' 4502988065 ')).toBe('4502988065');
    expect(valorVisible('horario', ' Mañana ')).toBe('Mañana');
    expect(valorVisible('dia', '2026-11-07T08:00')).toBe('2026-11-07');
  });
});
