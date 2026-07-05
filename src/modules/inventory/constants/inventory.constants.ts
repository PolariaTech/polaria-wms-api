import { WmsRol } from '../../../generated/prisma/client';

/** Roles que pueden bloquear posiciones de inventario en el mapa (POL-6). */
export const ROLES_INVENTARIO_LOCK = [
  WmsRol.configurador,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
  WmsRol.custodio,
  WmsRol.operario,
] as const;

export const ROLES_INVENTARIO_LECTURA = [
  ...ROLES_INVENTARIO_LOCK,
  WmsRol.administrador_cuenta,
  WmsRol.operador_cuenta,
] as const;

/** Tiempo máximo de lock antes de permitir takeover por jefe/configurador (ms). */
export const LOCK_STALE_MS = 5 * 60 * 1000;

export const ROLES_INVENTARIO_FORCE_UNLOCK = [
  WmsRol.configurador,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
] as const;
