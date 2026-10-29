/**
 * Partir un PDF por páginas para releerlo por bloques (REQ-187).
 *
 * Un solo pedido de ~134 renglones necesita ~14k tokens de salida (≈104 por renglón),
 * muy cerca del tope de algunos modelos. Si la lectura completa se corta o no cuadra
 * con el "Total pedido", se relee por bloques chicos y se concatenan los renglones.
 */

/** ≈60 renglones de pedido por bloque (≈6k tokens de salida, lejos de cualquier tope). */
export const MAX_CARACTERES_POR_BLOQUE = 4500;

/** Líneas del encabezado de la primera página que se repiten en cada bloque. */
const MAX_LINEAS_ENCABEZADO = 40;

const LINEA_ENCABEZADO_TABLA = /art[ií]culo|descripci[oó]n|producto/i;

/**
 * Reparte un texto ya extraído en "páginas" de ≈`tamano` caracteres sin partir una línea.
 * Sirve para releer por bloques un documento del que solo se conserva el texto (p. ej. un
 * PDF adjunto dentro de un .eml), sin necesitar el binario.
 */
export function partirTextoEnPaginas(texto: string, tamano = 2300): string[] {
  const paginas: string[] = [];
  let actual: string[] = [];
  let largo = 0;
  for (const linea of texto.split('\n')) {
    if (actual.length > 0 && largo + linea.length + 1 > tamano) {
      paginas.push(actual.join('\n'));
      actual = [];
      largo = 0;
    }
    actual.push(linea);
    largo += linea.length + 1;
  }
  if (actual.length > 0) paginas.push(actual.join('\n'));
  return paginas;
}

/**
 * Encabezado del documento (No. Pedido, entregar en, proveedor…): de la primera
 * página, hasta la fila de títulos de la tabla (incluida) o un tope de líneas.
 */
export function encabezadoDeDocumento(paginas: readonly string[]): string {
  const lineas = (paginas[0] ?? '').split('\n');
  const limite = Math.min(lineas.length, MAX_LINEAS_ENCABEZADO);
  for (let i = 0; i < limite; i += 1) {
    if (LINEA_ENCABEZADO_TABLA.test(lineas[i] ?? '') && i >= 3) {
      return lineas.slice(0, i + 1).join('\n');
    }
  }
  return lineas.slice(0, Math.min(limite, 25)).join('\n');
}

/**
 * Agrupa páginas contiguas hasta `maxCaracteres`. Una página más grande que el tope
 * va sola (nunca se parte a media fila). Todos los bloques menos el primero llevan el
 * encabezado del documento para conservar el No. Pedido, almacén de la sección, etc.
 */
export function construirBloques(
  paginas: readonly string[],
  maxCaracteres: number = MAX_CARACTERES_POR_BLOQUE,
): string[] {
  const conTexto = paginas.filter((pagina) => pagina.trim().length > 0);
  if (conTexto.length === 0) return [];

  const encabezado = encabezadoDeDocumento(paginas);
  const grupos: string[][] = [];
  let actual: string[] = [];
  let largo = 0;

  for (const pagina of conTexto) {
    if (actual.length > 0 && largo + pagina.length > maxCaracteres) {
      grupos.push(actual);
      actual = [];
      largo = 0;
    }
    actual.push(pagina);
    largo += pagina.length;
  }
  if (actual.length > 0) grupos.push(actual);

  return grupos.map((paginasDelBloque, indice) => {
    const cuerpo = paginasDelBloque.join('\n');
    if (indice === 0 || !encabezado) return cuerpo;
    return `${encabezado}\n${cuerpo}`;
  });
}
