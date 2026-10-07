import type { OrigenCorreoRenglon } from './origen-correo-ordenes-trabajo';

/** Timestamp local YYYY-MM-DD HH:mm:ss (como el bot de correo). */
export function formatHorarioIngest(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Sella Horario / Numero correo en cada renglón sin pisar entrega ya extraída.
 * Solo aplica si el caller manda `numeroCorreo` y/o `horario` (bot/n8n).
 * El orquestador puede persistir `origenCorreo` tal cual.
 */
export function stampOrigenCorreoMeta(
  rows: readonly OrigenCorreoRenglon[],
  meta: {
    numeroCorreo?: string | null;
    horario?: string | null;
    now?: Date;
  } = {},
): OrigenCorreoRenglon[] {
  const numeroCorreo = (meta.numeroCorreo ?? '').trim();
  const horarioExplicit = (meta.horario ?? '').trim();
  if (!numeroCorreo && !horarioExplicit) {
    return rows.map((row) => ({ ...row }));
  }
  const horario = horarioExplicit || formatHorarioIngest(meta.now ?? new Date());

  return rows.map((row) => ({
    ...row,
    Horario: (row.Horario ?? '').trim() || horario,
    'Numero correo': (row['Numero correo'] ?? '').trim() || numeroCorreo,
  }));
}
