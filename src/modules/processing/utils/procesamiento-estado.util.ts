import { EstadoProcesamiento } from '../../../generated/prisma/client';

/** Mapeo frio → Prisma */
export const FRIO_ESTADO_MAP = {
  Iniciado: EstadoProcesamiento.pendiente,
  'En curso': EstadoProcesamiento.en_proceso,
  Pendiente: EstadoProcesamiento.pendiente_cierre,
  Terminado: EstadoProcesamiento.terminada,
} as const;

export type TransicionProcesamientoError =
  | 'sin_operario_asignado'
  | 'solo_operario_asignado'
  | 'en_curso_a_terminado_invalido'
  | 'desperdicio_requerido'
  | 'estado_invalido';

export function assertTransicionProcesamiento(params: {
  estadoActual: EstadoProcesamiento;
  estadoSiguiente: EstadoProcesamiento;
  idOperarioAsignado: string | null;
  idUsuario: string;
  desperdicioKg?: number;
}): TransicionProcesamientoError | null {
  const { estadoActual, estadoSiguiente, idOperarioAsignado, idUsuario } =
    params;

  if (
    estadoActual === EstadoProcesamiento.pendiente &&
    estadoSiguiente === EstadoProcesamiento.en_proceso
  ) {
    if (!idOperarioAsignado) return 'sin_operario_asignado';
    if (idOperarioAsignado !== idUsuario) return 'solo_operario_asignado';
    return null;
  }

  if (
    estadoSiguiente === EstadoProcesamiento.terminada &&
    estadoActual === EstadoProcesamiento.en_proceso
  ) {
    return 'en_curso_a_terminado_invalido';
  }

  if (
    estadoSiguiente === EstadoProcesamiento.pendiente_cierre &&
    estadoActual === EstadoProcesamiento.en_proceso
  ) {
    const dk = params.desperdicioKg;
    if (dk === undefined || !Number.isFinite(Number(dk)) || Number(dk) < 0) {
      return 'desperdicio_requerido';
    }
    return null;
  }

  if (
    estadoSiguiente === EstadoProcesamiento.terminada &&
    estadoActual === EstadoProcesamiento.pendiente_cierre
  ) {
    return null;
  }

  if (estadoActual === estadoSiguiente) return null;

  return 'estado_invalido';
}

export function mensajeTransicionProcesamiento(
  code: TransicionProcesamientoError,
): string {
  switch (code) {
    case 'sin_operario_asignado':
      return 'Asigná un operario de bodega antes de pasar a en curso.';
    case 'solo_operario_asignado':
      return 'Solo el operario asignado puede pasar la orden a en curso.';
    case 'en_curso_a_terminado_invalido':
      return 'No se puede pasar de en curso a terminada directamente.';
    case 'desperdicio_requerido':
      return 'Indicá los kg de merma (desperdicio) al cerrar el procesamiento.';
    default:
      return 'Transición de estado no permitida.';
  }
}
