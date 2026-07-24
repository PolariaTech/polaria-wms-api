import { WmsRol } from '../../../generated/prisma/client';

export const CONTADOR_CLAVE_VIAJE_TRANSPORTE = 'viaje_transporte';
export const CONTADOR_CLAVE_GUIA_ENVIO = 'guia_envio';

/**
 * Valor en `movimiento_inventario.tipo_referencia`.
 * Debe cumplir `chk_movimiento_tipo_referencia` (orden_venta ya permitido).
 * El id_referencia apunta a la OV despachada; el viaje va en metadata.
 */
export const TIPO_REFERENCIA_DESPACHO_PAQUETE = 'orden_venta';

/** @deprecated Usar TIPO_REFERENCIA_DESPACHO_PAQUETE (viaje_transporte no está en el CHECK). */
export const TIPO_REFERENCIA_VIAJE_TRANSPORTE =
  TIPO_REFERENCIA_DESPACHO_PAQUETE;

/** Custodio arma el paquete y lo envía al rol transporte (flujo frio). */
export const ROLES_PAQUETE_DESPACHO = [
  WmsRol.configurador,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
  WmsRol.custodio,
] as const;

/** Transportista cierra la entrega con evidencia (flujo frio). */
export const ROLES_REGISTRAR_ENTREGA = [
  WmsRol.configurador,
  WmsRol.transportista,
  WmsRol.administrador_bodega,
  WmsRol.jefe_bodega,
] as const;

export function formatCodigoViaje(valor: bigint): string {
  return `TV-${String(valor).padStart(4, '0')}`;
}

export function formatCodigoGuia(valor: bigint): string {
  return `GE-${String(valor).padStart(4, '0')}`;
}
