import { WmsRol } from '../../../generated/prisma/client';

export const CONTADOR_CLAVE_SOLICITUD_PROCESAMIENTO = 'solicitud_procesamiento';
export const TIPO_REFERENCIA_PROCESAMIENTO = 'solicitud_procesamiento';

export const ROLES_PROCESAMIENTO_LECTURA = [
  WmsRol.configurador,
  WmsRol.administrador_cuenta,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
  WmsRol.procesador,
  WmsRol.operario,
] as const;

/** Jefe crea solicitudes de procesamiento (frio: jefe/orquestación). */
export const ROLES_PROCESAMIENTO_CREAR = [
  WmsRol.configurador,
  WmsRol.jefe_bodega,
] as const;

export const ROLES_PROCESAMIENTO_ASIGNAR = [
  WmsRol.configurador,
  WmsRol.jefe_bodega,
] as const;

export const ROLES_PROCESAMIENTO_EJECUTAR = [
  WmsRol.configurador,
  WmsRol.procesador,
] as const;

export function formatCodigoSolicitudProcesamiento(valor: bigint): string {
  return `PROC-${String(valor).padStart(6, '0')}`;
}
