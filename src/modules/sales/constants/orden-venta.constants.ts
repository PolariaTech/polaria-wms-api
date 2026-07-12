import { WmsRol } from '../../../generated/prisma/client';

export const TIPO_REFERENCIA_ORDEN_VENTA = 'orden_venta';

export const ROLES_OV_ESCRITURA = [
  WmsRol.configurador,
  WmsRol.administrador_cuenta,
  WmsRol.operador_cuenta,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
] as const;

export const ROLES_OV_LECTURA = ROLES_OV_ESCRITURA;
