/**
 * Regla determinista del respaldo del enrutador del chat de Reorganizar OT (cuando el
 * modelo no responde): ¿la instrucción pide releer el correo y los archivos?
 *
 * Palabras que hablan de los documentos (total, factura, PDF, correo, OC…) piden releer.
 * POL-413: «divide por orden de compra» reparte lo que YA existe; no es releer, salvo que
 * además hable del correo, los archivos o los totales.
 */

const HABLA_DE_DOCUMENTOS =
  /\b(factura|total|pdf|correo|archivo|adjunto|documento|orden(?:es)? de compra|occ?|po)\b|releer|rele[eé]|verific|cuadr/;
const PIDE_LEER_OTRA_VEZ =
  /\b(?:factura|total|pdf|correo|archivo|adjunto|documento)\b|releer|rele[eé]|verific|cuadr/;
const VERBO_DE_REPARTO = /\b(?:divid|separ|part[ei]|repart|pas[ae]|mueve|move)\w*/;
const MENCIONA_ORDEN_DE_COMPRA = /\b(?:orden(?:es)? de compra|occ?|po)\b/;

/** `texto` ya viene en minúsculas. */
export function pideReleerDocumentos(texto: string): boolean {
  if (!HABLA_DE_DOCUMENTOS.test(texto)) return false;
  const repartePorOc =
    VERBO_DE_REPARTO.test(texto) && MENCIONA_ORDEN_DE_COMPRA.test(texto);
  return !repartePorOc || PIDE_LEER_OTRA_VEZ.test(texto);
}
