import type { ArchivoTexto } from '../file-extractors';

/** Debajo de este largo un texto es demasiado corto para afirmar que dos son el mismo. */
const MIN_CARACTERES_CONTENIDO = 40;

function huellaContenido(contenido: string): string {
  return contenido
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * REQ-288: separa los documentos de texto que se leerían dos veces. Es repetido el adjunto
 * incrustado en un .eml que también se subió suelto (mismo nombre base) y el que trae el
 * mismo texto que otro aunque se llame distinto (el PDF reenviado con otro nombre). Se
 * conserva el suelto sobre el incrustado y, si ambos lo son, el primero.
 */
export function descartarDocumentosRepetidos(
  textos: readonly ArchivoTexto[],
  opciones: {
    separadorEml: string;
    nombreBase: (nombre: string) => string;
  },
): { unicos: ArchivoTexto[]; duplicados: string[] } {
  const esIncrustado = (texto: ArchivoTexto) =>
    texto.nombre.includes(opciones.separadorEml);
  const sueltos = new Set(
    textos
      .filter((texto) => !esIncrustado(texto))
      .map((texto) => opciones.nombreBase(texto.nombre)),
  );
  const porContenido = new Map<string, ArchivoTexto>();
  for (const texto of [...textos].sort(
    (a, b) => Number(esIncrustado(a)) - Number(esIncrustado(b)),
  )) {
    const huella = huellaContenido(texto.contenido);
    if (
      huella.length >= MIN_CARACTERES_CONTENIDO &&
      !porContenido.has(huella)
    ) {
      porContenido.set(huella, texto);
    }
  }

  const unicos: ArchivoTexto[] = [];
  const duplicados: string[] = [];
  for (const texto of textos) {
    const porNombre =
      esIncrustado(texto) && sueltos.has(opciones.nombreBase(texto.nombre));
    const huella = huellaContenido(texto.contenido);
    const conservado = porContenido.get(huella);
    const porTexto =
      huella.length >= MIN_CARACTERES_CONTENIDO &&
      conservado !== undefined &&
      conservado !== texto;
    if (porNombre || porTexto) duplicados.push(texto.nombre);
    else unicos.push(texto);
  }
  return { unicos, duplicados };
}
