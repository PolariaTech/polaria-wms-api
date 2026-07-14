import { WmsRol } from '../../generated/prisma/client';
import {
  isConfigurador,
  isRolEscrituraInventario,
  ROLES_ESCRITURA_INVENTARIO,
} from './roles';

/** Permisos atómicos del WMS. POL-33 ampliará el catálogo. */
export const PERMISSION = {
  INVENTORY_WRITE: 'inventory:write',
  INVENTORY_READ: 'inventory:read',
  WAREHOUSE_STATE_WRITE: 'warehouse_state:write',
  COUNTERS_WRITE: 'counters:write',
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

/**
 * Matriz mínima rol → permisos para escrituras sensibles (backend, bypass RLS).
 * Lecturas vía PostgREST usan RLS; no aparecen aquí.
 */
export const ROLE_PERMISSIONS: Readonly<Record<WmsRol, readonly Permission[]>> =
  {
    [WmsRol.configurador]: [
      PERMISSION.INVENTORY_WRITE,
      PERMISSION.INVENTORY_READ,
      PERMISSION.WAREHOUSE_STATE_WRITE,
      PERMISSION.COUNTERS_WRITE,
    ],
    [WmsRol.administrador_cuenta]: [PERMISSION.INVENTORY_READ],
    [WmsRol.operador_cuenta]: [PERMISSION.INVENTORY_READ],
    [WmsRol.administrador_bodega]: [
      PERMISSION.INVENTORY_WRITE,
      PERMISSION.INVENTORY_READ,
      PERMISSION.WAREHOUSE_STATE_WRITE,
      PERMISSION.COUNTERS_WRITE,
    ],
    [WmsRol.jefe_bodega]: [
      PERMISSION.INVENTORY_WRITE,
      PERMISSION.INVENTORY_READ,
      PERMISSION.WAREHOUSE_STATE_WRITE,
      PERMISSION.COUNTERS_WRITE,
    ],
    [WmsRol.custodio]: [PERMISSION.INVENTORY_READ],
    [WmsRol.operario]: [
      PERMISSION.INVENTORY_WRITE,
      PERMISSION.INVENTORY_READ,
      PERMISSION.WAREHOUSE_STATE_WRITE,
    ],
    [WmsRol.procesador]: [],
    [WmsRol.transportista]: [],
  };

export const SENSITIVE_WRITE_PERMISSIONS: readonly Permission[] = [
  PERMISSION.INVENTORY_WRITE,
  PERMISSION.WAREHOUSE_STATE_WRITE,
  PERMISSION.COUNTERS_WRITE,
];

export function hasPermission(idRol: WmsRol, permission: Permission): boolean {
  if (isConfigurador(idRol)) {
    return true;
  }

  return ROLE_PERMISSIONS[idRol]?.includes(permission) ?? false;
}

export function canInventoryWrite(idRol: WmsRol): boolean {
  return isConfigurador(idRol) || isRolEscrituraInventario(idRol);
}

export { ROLES_ESCRITURA_INVENTARIO };
