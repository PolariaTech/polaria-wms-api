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

const ID_PEDIDO_APLICATIVO = /^\s*PEDIDO\s+(ADP-\d{6}-\d{4}-[A-Z0-9]{2,6})\b/im;

/** ID del pedido del aplicativo (`ADP-261030-0944-OQX`), tal como va en el encabezado del correo. */
export function extractIdPedidoAplicativo(
  texto: string | null | undefined,
): string | null {
  return ID_PEDIDO_APLICATIVO.exec(texto ?? '')?.[1]?.toUpperCase() ?? null;
}

/**
 * REQ-231 (punto 6): el ID del pedido no se le deja al modelo. Si el correo es del
 * aplicativo, ese ID es la OC y el número de pedido de todos los renglones, siempre.
 */
export function aplicarIdPedidoAplicativo<T extends { numeroPedido: string | null }>(
  entrada: { ordenCompraHotel: string | null; lineas: T[] },
  texto: string | null | undefined,
): { ordenCompraHotel: string | null; lineas: T[] } {
  const id = extractIdPedidoAplicativo(texto);
  if (!id) return entrada;
  return {
    ordenCompraHotel: id,
    lineas: entrada.lineas.map((linea) => ({ ...linea, numeroPedido: id })),
  };
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
