/**
 * Si Mateo devolvió solo el nombre del almacén/centro ("Banquetes Ali")
 * pero el documento trae código + nombre ("ABAN Banquetes Ali"), antepone el código.
 * Aplica a cualquier cliente (SOLAYA, Xcaret, AVA, etc.).
 */

function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Ya trae prefijo tipo ABAN / BAWH / COPM / ACOE. */
function yaTieneCodigoPrefijo(almacen: string): boolean {
  return /^[A-ZÁÉÍÓÚÑ]{3,6}\s+\S/u.test(almacen.trim());
}

/**
 * Busca en el texto del PDF/correo un código alfabético corto delante del
 * nombre que Mateo extrajo y lo antepone. No inventa códigos.
 */
export function enrichAlmacenConCodigoDesdeTexto(
  almacen: string | null | undefined,
  textoFuente: string | null | undefined,
): string | null {
  const nombre = almacen?.trim() || '';
  if (!nombre) return null;

  const fuente = textoFuente?.trim() || '';
  if (!fuente || yaTieneCodigoPrefijo(nombre)) return nombre;

  const nNombre = normalizeLoose(nombre);
  if (nNombre.length < 4) return nombre;

  const re = /\b([A-ZÁÉÍÓÚÑ]{3,6})\s+([^\n\r|;]{3,80})/giu;
  let bestCode: string | null = null;

  for (const match of fuente.matchAll(re)) {
    const code = (match[1] ?? '').toUpperCase();
    const rest = (match[2] ?? '').trim();
    if (!code || !rest) continue;

    const nRest = normalizeLoose(rest);
    const solapa =
      nRest.includes(nNombre) ||
      nNombre.includes(nRest) ||
      (nNombre.length >= 6 &&
        nRest.startsWith(nNombre.slice(0, Math.min(10, nNombre.length))));

    if (!solapa) continue;
    if (/^(KGM|KGS|KG|CJ|PZA|PZ|UND|UN|PZAS)$/i.test(code)) continue;

    bestCode = code;
    break;
  }

  if (!bestCode) return nombre;
  return `${bestCode} ${nombre}`;
}

export function enrichLineasAlmacenConCodigoDesdeTexto<
  T extends { almacen: string | null },
>(lineas: T[], textoFuente: string | null | undefined): T[] {
  if (!textoFuente?.trim()) return lineas;
  return lineas.map((linea) => ({
    ...linea,
    almacen: enrichAlmacenConCodigoDesdeTexto(linea.almacen, textoFuente),
  }));
}
