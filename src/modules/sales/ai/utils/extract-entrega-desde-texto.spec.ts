import {
  extractDireccionShipToDesdeTexto,
  extractEntregaDesdeTexto,
  extraerHorarioDesdeTexto,
  normalizarHoraAHhMm,
} from './extract-entrega-desde-texto';

describe('normalizarHoraAHhMm', () => {
  it('convierte am/pm a 24h', () => {
    expect(normalizarHoraAHhMm('6', '00', 'am')).toBe('06:00');
    expect(normalizarHoraAHhMm('6', '00', 'pm')).toBe('18:00');
    expect(normalizarHoraAHhMm('12', '00', 'am')).toBe('00:00');
    expect(normalizarHoraAHhMm('12', '30', 'pm')).toBe('12:30');
  });
});

describe('extraerHorarioDesdeTexto', () => {
  it('lee hora única de entrega', () => {
    expect(
      extraerHorarioDesdeTexto('Hora de entrega 6:00 am\nFavor de confirmar'),
    ).toEqual({ horarioDesde: '06:00', horarioHasta: null });
  });

  it('lee rango 8:00 AM – 2:00 PM', () => {
    expect(
      extraerHorarioDesdeTexto(
        'Ventana de recepción: 8:00 AM – 2:00 PM en andén 3',
      ),
    ).toEqual({ horarioDesde: '08:00', horarioHasta: '14:00' });
  });

  it('lee de 8 a 14', () => {
    expect(extraerHorarioDesdeTexto('Entregar de 8 a 14 hrs')).toEqual({
      horarioDesde: '08:00',
      horarioHasta: '14:00',
    });
  });
});

describe('extractEntregaDesdeTexto', () => {
  it('prioriza fecha explícita dd/mm/aaaa cerca de entrega', () => {
    const got = extractEntregaDesdeTexto(
      'Propiedad: Fairmont\nFecha de entrega: 21/10/2026\nProductos...',
      '2026-10-16',
    );
    expect(got.fechaIso).toBe('2026-10-21');
    expect(got.fechaFrase).toMatch(/21\/10\/2026/);
  });

  it("lee '27 DE AGOSTO DE 2026' y hora 6:00 am", () => {
    const got = extractEntregaDesdeTexto(
      [
        'Buenas tardes,',
        'Envío adjunto pedido para entregar el 27 DE AGOSTO DE 2026 en Parque Xcaret:',
        'Hora de entrega 6:00 am',
        'Favor de confirmar de recibido',
      ].join('\n'),
      '2026-08-20',
    );
    expect(got.fechaIso).toBe('2026-08-27');
    expect(got.horarioDesde).toBe('06:00');
  });

  it('no inventa fecha ni hora si el cuerpo no las trae', () => {
    const got = extractEntregaDesdeTexto(
      'Haga clic en el botón Responder para enviar un correo\nwww.accorlive.com',
      '2026-10-16',
    );
    expect(got.fechaIso).toBeNull();
    expect(got.horarioDesde).toBeNull();
    expect(got.horarioHasta).toBeNull();
  });
});

describe('extractDireccionShipToDesdeTexto', () => {
  it('prefiere Ship To sobre Bill To', () => {
    const texto = [
      'Bill To:',
      'CESAR HILTON',
      'Av. Reforma 222, Ciudad de México, CDMX',
      '',
      'Ship To:',
      'HOSPITALITY SERVICES MAYA, S.A. de C.V.',
      'Blvd. Kukulcan km 17, Cancún, Q. Roo',
      '',
      'Item Description',
    ].join('\n');
    expect(extractDireccionShipToDesdeTexto(texto)).toBe(
      'HOSPITALITY SERVICES MAYA, S.A. de C.V., Blvd. Kukulcan km 17, Cancún, Q. Roo',
    );
  });

  it('lee Deliver To en una sola línea', () => {
    expect(
      extractDireccionShipToDesdeTexto(
        'Deliver To: Parque Xcaret, Playa del Carmen, QR 77710\nQty: 10',
      ),
    ).toBe('Parque Xcaret, Playa del Carmen, QR 77710');
  });
});
