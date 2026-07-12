import { WmsRol } from '../../../generated/prisma/client';

/** Roles que pueden cerrar recepción física contra OC (POL-5). */
export const ROLES_RECEPCION_ESCRITURA = [
  WmsRol.configurador,
  WmsRol.administrador_cuenta,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
  WmsRol.custodio,
] as const;

export const ROLES_RECEPCION_LECTURA = [
  ...ROLES_RECEPCION_ESCRITURA,
  WmsRol.operador_cuenta,
  WmsRol.operario,
] as const;

/**
 * Valores permitidos por `chk_movimiento_tipo_referencia` (migración 024):
 * orden_compra | orden_trabajo | orden_venta | solicitud_compra | manual
 */
export const TIPO_REFERENCIA_RECEPCION = 'orden_compra';
