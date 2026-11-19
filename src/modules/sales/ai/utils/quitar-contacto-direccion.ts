const CONTACTO_ETIQUETA_RE =
  /^(?:fax|tel(?:[eé]fono)?s?\b\.?|phone|celular|cel\b\.?|whatsapp|correos?\b|e-?mail|mail\b)/i;
const CONTACTO_CORREO_RE = /\S+@\S+\.\S+/;
const CONTACTO_TELEFONO_RE = /^\+?[\d\s().-]+$/;

/** Metadatos BirchStreet / Hilton que Mateo pega al final del Ship To (REQ-332). */
const DIRECCION_META_CORTE_RE =
  /\b(?:attn|attention|atenci[oó]n|sent\s*from|enviado\s*desde)\s*[:\-]/i;

const DIRECCION_META_SEGMENTO_RE =
  /^(?:attn|attention|atenci[oó]n|sent\s*from|enviado\s*desde)\b/i;

function esSegmentoDeContacto(segmento: string): boolean {
  if (DIRECCION_META_SEGMENTO_RE.test(segmento)) return true;
  if (CONTACTO_ETIQUETA_RE.test(segmento) || CONTACTO_CORREO_RE.test(segmento)) {
    return true;
  }
  return (
    CONTACTO_TELEFONO_RE.test(segmento) &&
    segmento.replace(/\D/g, '').length >= 7
  );
}

export function truncarMetaNoDireccion(
  valor: string | null | undefined,
): string {
  const raw = (valor ?? '').trim();
  if (!raw) return '';
  const corte = DIRECCION_META_CORTE_RE.exec(raw);
  if (!corte || corte.index == null) return raw;
  return raw.slice(0, corte.index).trim().replace(/[,;\s]+$/g, '');
}

/**
 * Quita de una dirección de entrega segmentos de correo, fax, teléfono,
 * Attn o Sent From. Devuelve null si no queda una dirección.
 */
export function quitarContactoDeDireccion(
  valor: string | null | undefined,
): string | null {
  const sinMeta = truncarMetaNoDireccion(valor);
  const segmentos = sinMeta
    .split(/[,;\n]/)
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter((s) => s && !esSegmentoDeContacto(s));
  const limpio = segmentos.join(', ');
  return limpio.length >= 5 ? limpio : null;
}
