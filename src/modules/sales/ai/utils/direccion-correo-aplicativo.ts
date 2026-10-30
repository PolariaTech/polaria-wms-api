/**
 * REQ-231: los correos del aplicativo interno («Pedidos · Aguacates de Puebla») traen la
 * dirección de entrega en una línea propia `Dirección: …`. Esa línea manda sobre la
 * regla genérica Ship To, que con el texto del PDF terminaba guardando el correo de
 * facturación y la «Lista de precios» como dirección.
 */

import { extractDireccionShipToDesdeTexto } from './extract-entrega-desde-texto';

const MARCA_CORREO_APLICATIVO = /^\s*PEDIDO\s+ADP-\d{6}-\d{4}-\w+/im;
const LINEA_DIRECCION = /^[ \t]*Direcci[oó]n[ \t]*:[ \t]*(.*)$/im;
const ES_CORREO_ELECTRONICO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function extractDireccionCorreoAplicativo(
  texto: string | null | undefined,
): string | null {
  const raw = (texto ?? '').replace(/\r\n/g, '\n');
  if (!MARCA_CORREO_APLICATIVO.test(raw)) return null;

  const valor = LINEA_DIRECCION.exec(raw)?.[1]?.replace(/\s+/g, ' ').trim();
  if (!valor || valor.length < 3) return null;
  if (ES_CORREO_ELECTRONICO.test(valor)) return null;
  return valor;
}

/** Dirección de entrega: la línea del correo del aplicativo y, si no hay, la regla Ship To. */
export function resolveDireccionEntregaDesdeTexto(
  texto: string | null | undefined,
): string | null {
  return (
    extractDireccionCorreoAplicativo(texto) ??
    extractDireccionShipToDesdeTexto(texto)
  );
}
