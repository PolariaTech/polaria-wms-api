/** Zona horaria operativa de Polaria (Colombia, sin DST). */
const TZ_OFFSET = '-05:00';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface BodegaReportesFechaRange {
  /** YYYY-MM-DD resuelto */
  fechaDesde: string;
  /** YYYY-MM-DD resuelto */
  fechaHasta: string;
  /** Inicio inclusivo del rango (timestamptz) */
  desdeAt: Date;
  /** Fin inclusivo del rango (timestamptz) */
  hastaAt: Date;
}

/** Fecha calendario de hoy en America/Bogota (`YYYY-MM-DD`). */
export function todayIsoDateBogota(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function normalizeIsoDate(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const day = value.slice(0, 10);
  if (!ISO_DATE_RE.test(day)) return fallback;
  return day;
}

/**
 * Resuelve rango de reportes. Si falta un extremo, usa hoy (Bogotá).
 * No valida desde <= hasta (eso lo hace el service).
 */
export function resolveBodegaReportesFechaRange(input: {
  fechaDesde?: string;
  fechaHasta?: string;
  now?: Date;
}): BodegaReportesFechaRange {
  const today = todayIsoDateBogota(input.now);
  const fechaDesde = normalizeIsoDate(input.fechaDesde, today);
  const fechaHasta = normalizeIsoDate(input.fechaHasta, today);

  return {
    fechaDesde,
    fechaHasta,
    desdeAt: new Date(`${fechaDesde}T00:00:00.000${TZ_OFFSET}`),
    hastaAt: new Date(`${fechaHasta}T23:59:59.999${TZ_OFFSET}`),
  };
}
