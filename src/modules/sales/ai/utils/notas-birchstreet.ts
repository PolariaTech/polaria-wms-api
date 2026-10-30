/**
 * REQ-239: en las notas generales de los pedidos de BirchStreet no van horarios (viven en
 * las ventanas de entrega), ni correos, ni la dirección de entrega, ni nombres de contacto.
 * Se quitan las frases que lo traen y se conserva el resto tal como vino.
 */

const ES_BIRCHSTREET = /birchstreet\.net/i;

const HORARIO =
  /\b(?:horario|schedule|hours?)\b|\d{1,2}:\d{2}|\b\d{1,2}\s*(?:a\.?\s*m\.?|p\.?\s*m\.?)(?![a-z])/i;
const CORREO = /@/;
const ETIQUETA_CONTACTO_O_DIRECCION =
  /\b(?:attn|atenci[oó]n|contacto|contact|sent\s+(?:by|from)|ship\s*to|deliver\s*to|direcci[oó]n(?:\s+de\s+(?:entrega|env[ií]o))?)\s*:/i;

/** Cada línea y, dentro de ella, cada frase (corta en «. » seguido de mayúscula). */
const FRASES = /\n|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/;

function esRuido(frase: string): boolean {
  return (
    HORARIO.test(frase) ||
    CORREO.test(frase) ||
    ETIQUETA_CONTACTO_O_DIRECCION.test(frase)
  );
}

export function limpiarNotasBirchstreet(
  notas: string | null | undefined,
  origenTexto: string | null | undefined,
): string {
  const texto = (notas ?? '').trim();
  if (!texto) return '';
  if (!ES_BIRCHSTREET.test(origenTexto ?? '')) return texto;
  return texto
    .split(FRASES)
    .map((frase) => frase.trim())
    .filter((frase) => frase && !esRuido(frase))
    .join(' ');
}
