import {
  resolveBodegaReportesFechaRange,
  todayIsoDateBogota,
} from './bodega-reportes-fecha-range.util';

describe('bodega-reportes-fecha-range.util', () => {
  it('usa hoy (Bogotá) cuando no hay fechas', () => {
    const now = new Date('2026-08-04T15:30:00.000Z');
    const range = resolveBodegaReportesFechaRange({ now });

    expect(range.fechaDesde).toBe('2026-08-04');
    expect(range.fechaHasta).toBe('2026-08-04');
    expect(todayIsoDateBogota(now)).toBe('2026-08-04');
    expect(range.desdeAt.toISOString()).toBe('2026-08-04T05:00:00.000Z');
    expect(range.hastaAt.toISOString()).toBe('2026-08-05T04:59:59.999Z');
  });

  it('respeta el rango enviado', () => {
    const range = resolveBodegaReportesFechaRange({
      fechaDesde: '2026-07-01',
      fechaHasta: '2026-07-31T12:00:00.000Z',
    });

    expect(range.fechaDesde).toBe('2026-07-01');
    expect(range.fechaHasta).toBe('2026-07-31');
  });
});
