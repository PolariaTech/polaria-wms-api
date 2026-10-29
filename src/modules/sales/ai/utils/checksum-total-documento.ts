/**
 * Verificación determinista de una lectura de pedido contra el documento (REQ-187).
 *
 * La IA puede omitir renglones sin avisar (medido en OV-940: 72 de 134). El documento
 * suele traer su propio "Total pedido"; la suma de cantidad × precio de lo extraído debe
 * coincidir con él. Esto NO usa IA: es la única fuente de verdad para decir que una
 * lectura "cuadra".
 */

/** Tolerancia en la moneda del documento (redondeos de centavos entre filas). */
export const TOLERANCIA_TOTAL_DOCUMENTO = 0.05;

const TOTAL_PEDIDO_RE =
  /total\s+(?:del\s+)?pedido\s*:?\s*(?:MXN|USD|EUR|\$)?\s*(\d[\d.,]*)/gi;

export interface RenglonParaTotal {
  Cantidad?: number | string | null;
  Precio?: number | string | null;
}

export interface VerificacionTotalDocumento {
  /** Total que declara el documento; null si no se encontró (no verificable). */
  totalDocumento: number | null;
  /** Suma de cantidad × precio de los renglones extraídos. */
  importe: number;
  /** importe − totalDocumento; null si no hay total que comparar. */
  diferencia: number | null;
  /** true/false si hay total; null si el documento no declara uno. */
  cuadra: boolean | null;
}

/** "27,905.25" → 27905.25; "27.905,25" → 27905.25; "1,234" → 1234. */
export function parseMonto(raw: string): number | null {
  const limpio = raw.trim().replace(/[^\d.,]/g, '');
  if (!limpio) return null;

  const ultimoPunto = limpio.lastIndexOf('.');
  const ultimaComa = limpio.lastIndexOf(',');
  let normalizado: string;

  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    // El último separador es el decimal.
    normalizado =
      ultimoPunto > ultimaComa
        ? limpio.replace(/,/g, '')
        : limpio.replace(/\./g, '').replace(',', '.');
  } else if (ultimaComa >= 0) {
    // Solo comas: miles si todos los grupos finales son de 3 dígitos.
    const grupos = limpio.split(',');
    const esMiles = grupos.slice(1).every((g) => g.length === 3);
    normalizado = esMiles ? limpio.replace(/,/g, '') : limpio.replace(',', '.');
  } else {
    normalizado = limpio;
  }

  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

/** Último "Total pedido: MXN 27,905.25" del texto (el total va al final del documento). */
export function extraerTotalDocumento(texto: string): number | null {
  let ultimo: number | null = null;
  for (const match of texto.matchAll(TOTAL_PEDIDO_RE)) {
    const valor = parseMonto(match[1] ?? '');
    if (valor !== null) ultimo = valor;
  }
  return ultimo;
}

function aNumero(valor: number | string | null | undefined): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number(valor.replace(',', '.').trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function sumarImportes(renglones: readonly RenglonParaTotal[]): number {
  const total = renglones.reduce(
    (suma, r) => suma + aNumero(r.Cantidad) * aNumero(r.Precio),
    0,
  );
  return Math.round(total * 100) / 100;
}

export function verificarTotalDocumento(
  textoDocumento: string,
  renglones: readonly RenglonParaTotal[],
  tolerancia: number = TOLERANCIA_TOTAL_DOCUMENTO,
): VerificacionTotalDocumento {
  const importe = sumarImportes(renglones);
  const totalDocumento = extraerTotalDocumento(textoDocumento);
  if (totalDocumento === null) {
    return { totalDocumento: null, importe, diferencia: null, cuadra: null };
  }
  const diferencia = Math.round((importe - totalDocumento) * 100) / 100;
  return {
    totalDocumento,
    importe,
    diferencia,
    cuadra: Math.abs(diferencia) <= tolerancia,
  };
}
