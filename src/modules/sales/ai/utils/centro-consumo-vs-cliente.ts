/**
 * Evita que Mateo (o el documento) deje la denominación comercial / hotel
 * en "centro de consumo". Son campos distintos.
 */
function normalizeNombre(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const PARECE_AREA_INTERNA =
  /\b(cocin|banquet|bar\b|cantina|almac[eé]n|whisky|consumo|and[eé]n|dock|steward|pasillo|piso|room\s*service|room\s*svc|costo)\b/i;

/**
 * Si el "centro" es en realidad el mismo nombre del cliente/hotel/marca,
 * lo descartamos (null). Si parece cocina/área interna, se conserva.
 */
export function resolveCentroConsumoSinConfundirConCliente(
  centroConsumo: string | null | undefined,
  nombreCliente: string | null | undefined,
): string | null {
  const centro = centroConsumo?.trim() || '';
  if (!centro) return null;

  const cliente = nombreCliente?.trim() || '';
  if (!cliente) return centro;

  const nCentro = normalizeNombre(centro);
  const nCliente = normalizeNombre(cliente);
  if (!nCentro || !nCliente) return centro;

  if (nCentro === nCliente) return null;

  const solapados =
    nCliente.includes(nCentro) ||
    nCentro.includes(nCliente) ||
    (nCentro.length >= 8 &&
      nCliente.length >= 8 &&
      (nCentro.startsWith(nCliente.slice(0, 12)) ||
        nCliente.startsWith(nCentro.slice(0, 12))));

  if (solapados && !PARECE_AREA_INTERNA.test(centro)) {
    return null;
  }

  return centro;
}
