import { WmsRol } from '../../generated/prisma/client';

/** Rol de plataforma (TI). Bypass de filtros tenant en operaciones backend. */
export const ROL_PLATAFORMA = WmsRol.configurador;

/** Roles con alcance comercial (nivel cuenta). */
export const ROLES_NIVEL_CUENTA = [
  WmsRol.administrador_cuenta,
  WmsRol.operador_cuenta,
] as const;

/** Roles con alcance físico (nivel bodega). */
export const ROLES_NIVEL_BODEGA = [
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
  WmsRol.custodio,
  WmsRol.operario,
] as const;

/** Roles que pueden ejecutar escrituras sensibles de inventario vía backend (POL-33). */
export const ROLES_ESCRITURA_INVENTARIO = [
  WmsRol.configurador,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
  WmsRol.operario,
] as const;

export type RolEscrituraInventario = (typeof ROLES_ESCRITURA_INVENTARIO)[number];

export function isConfigurador(idRol: WmsRol): boolean {
  return idRol === WmsRol.configurador;
}

export function isRolEscrituraInventario(idRol: WmsRol): boolean {
  return (ROLES_ESCRITURA_INVENTARIO as readonly WmsRol[]).includes(idRol);
}

/**
 * Matriz rol × dominio (resumen). Detalle de permisos en permissions.ts.
 *
 * | Dominio              | configurador | admin cuenta | operador cuenta | admin/jefe bodega | operario |
 * |----------------------|:------------:|:------------:|:---------------:|:-----------------:|:--------:|
 * | Catálogo plataforma  | RW           | R            | R               | R                 | R        |
 * | Escritura inventario | RW           | —            | —               | RW                | RW       |
 * | Lecturas operativas  | R            | R (tenant)   | R (cuenta)      | R (bodega)        | R        |
 */
export const MATRIZ_ROL_DOMINIO = {
  PLATAFORMA: [WmsRol.configurador],
  TENANT_CUENTA: ROLES_NIVEL_CUENTA,
  TENANT_BODEGA: ROLES_NIVEL_BODEGA,
  INVENTARIO_WRITE: ROLES_ESCRITURA_INVENTARIO,
} as const;
