/**
 * REQ-239: la dirección de entrega de los correos de BirchStreet llega con el bloque
 * «Attn: <nombre>, Sent From: <hotel>» pegado al final, y a veces con correos, fax o
 * teléfonos. Nada de eso es dirección: va en sus propios campos.
 */

/** Desde aquí hasta el final ya no es dirección (ATTN / FROM y todo lo que les sigue). */
const MARCA_ATENCION_O_REMITENTE =
  /(?:^|[\s.,;])(?:attn|attention|atenci[oó]n|sent\s*from|from)\s*:/i;

const ETIQUETA_CONTACTO =
  /^(?:fax|tel(?:[eé]fono)?s?\b\.?|phone|celular|cel\b\.?|whatsapp|correos?\b|e-?mail|mail\b)/i;
const TIENE_CORREO = /\S+@\S+\.\S+/;
const SOLO_TELEFONO = /^\+?[\d\s().-]+$/;

function esSegmentoDeContacto(segmento: string): boolean {
  if (ETIQUETA_CONTACTO.test(segmento) || TIENE_CORREO.test(segmento)) {
    return true;
  }
  return (
    SOLO_TELEFONO.test(segmento) && segmento.replace(/\D/g, '').length >= 7
  );
}

/**
 * Deja solo la dirección física: corta desde ATTN / FROM y quita los segmentos
 * (separados por coma, punto y coma o salto de línea) que son correo, fax o teléfono.
 * Devuelve null si no queda una dirección.
 */
export function limpiarDireccionEntrega(
  valor: string | null | undefined,
): string | null {
  const texto = valor ?? '';
  const marca = MARCA_ATENCION_O_REMITENTE.exec(texto);
  const hastaMarca = marca ? texto.slice(0, marca.index) : texto;
  const limpio = hastaMarca
    .split(/[,;\n]/)
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter((s) => s && !esSegmentoDeContacto(s))
    .join(', ')
    .replace(/[\s.,;]+$/, '');
  return limpio.length >= 5 ? limpio : null;
}
