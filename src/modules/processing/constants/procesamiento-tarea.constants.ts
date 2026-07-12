export const TAREA_SOLICITUD_PREFIX = 'solicitud_proc:';

export function buildTareaSolicitudDescripcion(
  idSolicitudProcesamiento: string,
): string {
  return `${TAREA_SOLICITUD_PREFIX}${idSolicitudProcesamiento}`;
}

export function parseTareaSolicitudId(descripcion: string | null): string | null {
  if (!descripcion?.startsWith(TAREA_SOLICITUD_PREFIX)) return null;
  const id = descripcion.slice(TAREA_SOLICITUD_PREFIX.length).trim();
  return id || null;
}

export const OT_PROCESAMIENTO_META_PREFIX = 'proc_ot:';

export type RolDevolucionProcesamiento = 'procesado' | 'desperdicio';

export function buildObservacionesOtProcesamiento(
  rol: RolDevolucionProcesamiento,
  idSolicitud: string,
): string {
  return `${OT_PROCESAMIENTO_META_PREFIX}${rol}:${idSolicitud}`;
}

export function parseObservacionesOtProcesamiento(
  observaciones: string | null,
): { rol: RolDevolucionProcesamiento; idSolicitud: string } | null {
  if (!observaciones?.startsWith(OT_PROCESAMIENTO_META_PREFIX)) return null;
  const rest = observaciones.slice(OT_PROCESAMIENTO_META_PREFIX.length);
  const [rol, idSolicitud] = rest.split(':');
  if (
    (rol === 'procesado' || rol === 'desperdicio') &&
    idSolicitud?.trim()
  ) {
    return { rol, idSolicitud: idSolicitud.trim() };
  }
  return null;
}
