/** Largo máximo de cualquier texto que viaja al modelo o vuelve de él (R5, R8). */
export const MAX_TEXTO_REAGRUPACION = 60;

/** Caracteres de control, separadores de línea y de ancho cero. */
function esCaracterInvisible(codigo: number): boolean {
  return (
    codigo <= 0x1f ||
    (codigo >= 0x7f && codigo <= 0x9f) ||
    (codigo >= 0x200b && codigo <= 0x200f) ||
    codigo === 0x2028 ||
    codigo === 0x2029 ||
    codigo === 0xfeff
  );
}

/** Quita caracteres de control y marcado, colapsa espacios y recorta por puntos de código. */
export function sanitizarTextoCorto(
  valor: unknown,
  max: number = MAX_TEXTO_REAGRUPACION,
): string {
  if (typeof valor !== 'string') return '';
  const limpio = Array.from(valor, (caracter) =>
    esCaracterInvisible(caracter.codePointAt(0) ?? 0) ? ' ' : caracter,
  )
    .join('')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(limpio).slice(0, max).join('');
}
