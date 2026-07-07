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

export const ROLES_ORDEN_TRABAJO_CREAR = [
  WmsRol.configurador,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
] as const;

export const ROLES_ORDEN_TRABAJO_EJECUTAR = [
  WmsRol.configurador,
  WmsRol.custodio,
  WmsRol.operario,
] as const;

export const ROLES_TAREA_COLA_GESTION = [
  WmsRol.configurador,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
  WmsRol.custodio,
  WmsRol.operario,
] as const;

export const ROLES_ALERTA_GESTION = [
  WmsRol.configurador,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
] as const;

export const ROLES_ALERTA_EJECUTAR = [
  WmsRol.configurador,
  WmsRol.custodio,
  WmsRol.operario,
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
