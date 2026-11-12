/**
 * REQ-310: el correo de contacto de la OV debe ser el del comprador, no el del proveedor.
 * En las OC de hoteles (BirchStreet) el documento trae un bloque «Supplier:» con el correo del
 * proveedor y otro «Sent From:» con el del comprador. Estas funciones separan los dos bloques.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Dominio y cuentas del proveedor: nunca son el contacto de entrega. */
const CORREO_PROVEEDOR_RE = [
  /@aguacatesdepuebla\.com$/i,
  /^admonaguacatesdepuebla@gmail\.com$/i,
];

const ENCABEZADO_BLOQUE_RE =
  /^\s*(?:bill\s*to|ship\s*to|sent\s*from|po\s*number|buyer|order\s*date|deliver(?:y)?\s*to)\s*:/i;
const INICIO_PROVEEDOR_RE = /^\s*supplier\s*:/i;
const INICIO_ENVIADO_POR_RE = /^\s*sent\s*from\s*:/i;
/** Un bloque de dirección no pasa de unas pocas líneas. */
const MAX_LINEAS_BLOQUE = 12;

export function esCorreoProveedor(email: string | null | undefined): boolean {
  const value = (email ?? '').trim();
  return value !== '' && CORREO_PROVEEDOR_RE.some((re) => re.test(value));
}

/** Rango [inicio, fin) de líneas del bloque que empieza en `inicio`, hasta el siguiente encabezado. */
function finDeBloque(lineas: readonly string[], inicio: number): number {
  const tope = Math.min(lineas.length, inicio + 1 + MAX_LINEAS_BLOQUE);
  for (let i = inicio + 1; i < tope; i += 1) {
    if (ENCABEZADO_BLOQUE_RE.test(lineas[i]!)) return i;
  }
  return tope;
}

/** Quita del texto los bloques «Supplier:» (dirección y correo del proveedor). */
export function quitarBloqueProveedor(texto: string): string {
  const lineas = texto.split('\n');
  const salida: string[] = [];
  let i = 0;
  while (i < lineas.length) {
    if (INICIO_PROVEEDOR_RE.test(lineas[i]!)) {
      i = finDeBloque(lineas, i);
      continue;
    }
    salida.push(lineas[i]!);
    i += 1;
  }
  return salida.join('\n');
}

/** Primer correo del bloque «Sent From:» (quien envía la OC es el comprador). */
export function correoDelBloqueEnviadoPor(texto: string): string | null {
  const lineas = texto.split('\n');
  for (let i = 0; i < lineas.length; i += 1) {
    if (!INICIO_ENVIADO_POR_RE.test(lineas[i]!)) continue;
    const fin = finDeBloque(lineas, i);
    const bloque = lineas.slice(i, fin).join('\n');
    const email = (bloque.match(EMAIL_RE) ?? []).find(
      (candidato) => !esCorreoProveedor(candidato),
    );
    if (email) return email;
  }
  return null;
}
