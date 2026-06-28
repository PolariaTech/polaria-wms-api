import { WmsRol } from '../../../generated/prisma/client';

export const CONTADOR_CLAVE_ORDEN_COMPRA = 'orden_compra';
export const CODIGO_OC_PREFIX = 'OC-';

export const ROLES_OC_ESCRITURA = [
  WmsRol.configurador,
  WmsRol.administrador_cuenta,
  WmsRol.operador_cuenta,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
] as const;

export const ROLES_OC_LECTURA = ROLES_OC_ESCRITURA;

export function formatCodigoOrden(secuencia: bigint): string {
  return `${CODIGO_OC_PREFIX}${secuencia.toString().padStart(6, '0')}`;
}
