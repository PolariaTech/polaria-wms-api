/**
 * REQ-231: los correos del aplicativo interno (芦Pedidos 路 Aguacates de Puebla禄) traen la
 * direcci贸n de entrega en una l铆nea propia `Direcci贸n: 鈥. Esa l铆nea manda sobre la
 * regla gen茅rica Ship To, que con el texto del PDF terminaba guardando el correo de
 * facturaci贸n y la 芦Lista de precios禄 como direcci贸n.
 */

import { extractDireccionShipToDesdeTexto } from './extract-entrega-desde-texto';

const MARCA_CORREO_APLICATIVO = /^\s*PEDIDO\s+ADP-\d{6}-\d{4}-\w+/im;
const LINEA_DIRECCION = /^[ \t]*Direcci[o贸]n[ \t]*:[ \t]*(.*)$/im;
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

/** Direcci髇 de entrega: la l韓ea del correo del aplicativo y, si no hay, la regla Ship To. */
export function resolveDireccionEntregaDesdeTexto(
  texto: string | null | undefined,
): string | null {
  return (
    extractDireccionCorreoAplicativo(texto) ??
    extractDireccionShipToDesdeTexto(texto)
  );
}
