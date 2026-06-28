import { WmsRol } from '../../../generated/prisma/client';

export const CONTADOR_CLAVE_SOLICITUD_COMPRA = 'solicitud_compra';
export const CODIGO_SOL_PREFIX = 'SOL-';

export const ROLES_SOL_ESCRITURA = [
  WmsRol.configurador,
  WmsRol.administrador_cuenta,
  WmsRol.operador_cuenta,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
] as const;

export const ROLES_SOL_APROBACION = [
  WmsRol.configurador,
  WmsRol.administrador_cuenta,
] as const;

export const ROLES_SOL_LECTURA = ROLES_SOL_ESCRITURA;

export function formatCodigoSolicitud(secuencia: bigint): string {
  return `${CODIGO_SOL_PREFIX}${secuencia.toString().padStart(6, '0')}`;
}
