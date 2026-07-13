/** Marcador en descripcion de tarea / observaciones OT (frio). */
export const SOLICITUD_PROCESAMIENTO_MARKER = 'solicitudProcesamiento:';

/** Prefijo legacy (solicitudes creadas antes del flujo OT). */
export const TAREA_SOLICITUD_PREFIX = 'solicitud_proc:';

export function buildSolicitudProcesamientoRef(
  idSolicitudProcesamiento: string,
): string {
  return `${SOLICITUD_PROCESAMIENTO_MARKER}${idSolicitudProcesamiento}`;
}

export function buildTareaProcesamientoDescripcion(
  idSolicitudProcesamiento: string,
  kilosPrimario: number,
): string {
  return `Almacenamiento → Procesamiento · ${buildSolicitudProcesamientoRef(idSolicitudProcesamiento)} · ${kilosPrimario} kg`;
}

/** @deprecated Usar buildTareaProcesamientoDescripcion */
export function buildTareaSolicitudDescripcion(
  idSolicitudProcesamiento: string,
): string {
  return `${TAREA_SOLICITUD_PREFIX}${idSolicitudProcesamiento}`;
}

export function parseSolicitudProcesamientoId(
  descripcion: string | null,
): string | null {
  if (!descripcion) return null;

  const markerIdx = descripcion.indexOf(SOLICITUD_PROCESAMIENTO_MARKER);
  if (markerIdx >= 0) {
    const id = descripcion
      .slice(markerIdx + SOLICITUD_PROCESAMIENTO_MARKER.length)
      .split(/[\s·|]/)[0]
      ?.trim();
    return id || null;
  }

  if (descripcion.startsWith(TAREA_SOLICITUD_PREFIX)) {
    const id = descripcion.slice(TAREA_SOLICITUD_PREFIX.length).trim();
    return id || null;
  }

  return null;
}

/** @deprecated Usar parseSolicitudProcesamientoId */
export function parseTareaSolicitudId(descripcion: string | null): string | null {
  return parseSolicitudProcesamientoId(descripcion);
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

export function buildObservacionesOtAProcesamiento(
  idSolicitudProcesamiento: string,
): string {
  return `flujo:a_procesamiento|${buildSolicitudProcesamientoRef(idSolicitudProcesamiento)}`;
}
