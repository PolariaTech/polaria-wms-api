import { WmsRol } from '../../../generated/prisma/client';
import type { Prisma } from '../../../generated/prisma/client';

export const CONTADOR_CLAVE_SOLICITUD_PROCESAMIENTO = 'solicitud_procesamiento';

/** Tipo lógico de la referencia (auditoría / metadata). */
export const TIPO_REFERENCIA_LOGICA_PROCESAMIENTO = 'solicitud_procesamiento';

/**
 * Valor persistido en `movimiento_inventario.tipo_referencia`.
 * `manual` cumple `chk_movimiento_tipo_referencia` sin migración 048.
 * Tras aplicar docs/migrations/048, puede cambiarse a TIPO_REFERENCIA_LOGICA_PROCESAMIENTO.
 */
export const TIPO_REFERENCIA_PROCESAMIENTO = 'manual';

export function metadataMovimientoProcesamiento(
  fase: string,
  extra?: Record<string, string | number | boolean | null>,
): Prisma.InputJsonValue {
  return {
    refTipo: TIPO_REFERENCIA_LOGICA_PROCESAMIENTO,
    fase,
    ...extra,
  };
}

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

export const ROLES_PROCESAMIENTO_ASIGNAR_OPERARIO = [
  WmsRol.configurador,
  WmsRol.jefe_bodega,
] as const;

export const ROLES_PROCESAMIENTO_INICIAR = [
  WmsRol.configurador,
  WmsRol.operario,
] as const;

export const ROLES_PROCESAMIENTO_ASIGNAR = [
  WmsRol.configurador,
  WmsRol.jefe_bodega,
] as const;

export const ROLES_PROCESAMIENTO_EJECUTAR = [
  WmsRol.configurador,
  WmsRol.procesador,
] as const;

/** Tras declarar merma: crea OT hacia almacén (frio: front justo después de cerrar). */
export const ROLES_PROCESAMIENTO_POST_CIERRE = [
  WmsRol.configurador,
  WmsRol.jefe_bodega,
  WmsRol.procesador,
] as const;

export function formatCodigoSolicitudProcesamiento(valor: bigint): string {
  return `PROC-${String(valor).padStart(6, '0')}`;
}
