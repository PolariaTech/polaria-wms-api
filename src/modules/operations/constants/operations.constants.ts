import { WmsRol } from '../../../generated/prisma/client';

export const CONTADOR_CLAVE_ORDEN_TRABAJO = 'orden_trabajo';
export const TIPO_REFERENCIA_ORDEN_TRABAJO = 'orden_trabajo';
export const TIPO_REFERENCIA_TAREA_COLA = 'tarea_cola';
export const METADATA_SUBTIPO_LLAMADA_JEFE = 'llamada_jefe';

export const ROLES_OPERACIONES_LECTURA = [
  WmsRol.configurador,
  WmsRol.administrador_cuenta,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
  WmsRol.custodio,
  WmsRol.operario,
  WmsRol.procesador,
] as const;

/** Solo jefe crea órdenes (frio: canUseOrderForm = isJefe). */
export const ROLES_ORDEN_TRABAJO_CREAR = [
  WmsRol.configurador,
  WmsRol.jefe_bodega,
] as const;

/** Solo operario ejecuta órdenes de trabajo (frio: canExecuteWorkOrders). */
export const ROLES_ORDEN_TRABAJO_EJECUTAR = [
  WmsRol.configurador,
  WmsRol.operario,
] as const;

/** Jefe asigna tareas a operario/procesador. */
export const ROLES_TAREA_COLA_ASIGNAR = [
  WmsRol.configurador,
  WmsRol.jefe_bodega,
] as const;

/** Operario o procesador completan tareas (validación por tipo en servicio). */
export const ROLES_TAREA_COLA_COMPLETAR = [
  WmsRol.configurador,
  WmsRol.operario,
  WmsRol.procesador,
] as const;

/** Jefe gestiona alertas; admin bodega solo lectura. */
export const ROLES_ALERTA_GESTION = [
  WmsRol.configurador,
  WmsRol.jefe_bodega,
] as const;

/** Operario ejecuta alertas asignadas. */
export const ROLES_ALERTA_EJECUTAR = [
  WmsRol.configurador,
  WmsRol.operario,
] as const;

/** Reportes de bodega (admin bodega + jefe, solo lectura). */
export const ROLES_REPORTES_BODEGA = [
  WmsRol.configurador,
  WmsRol.administrador_cuenta,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
] as const;

export const ROLES_LLAMADA_CREAR = [
  WmsRol.configurador,
  WmsRol.operario,
  WmsRol.procesador,
] as const;

export const ROLES_LLAMADA_ATENDER = [
  WmsRol.configurador,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
] as const;

export function formatCodigoOrdenTrabajo(valor: bigint): string {
  return `OT-${String(valor).padStart(6, '0')}`;
}
