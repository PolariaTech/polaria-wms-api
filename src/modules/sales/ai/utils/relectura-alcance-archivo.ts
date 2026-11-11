/**
 * POL-414 · «Solo X» cuando X es un archivo, resuelto en código y sin IA.
 *
 * Si la instrucción COMPLETA es «solo X» y X coincide con el nombre de un archivo leído,
 * el límite es ese archivo: las diferencias que se tocan son las de su número de pedido
 * (OC). Es repetible: no depende de que un modelo se decida. Cuando X también podría ser
 * un almacén, se elige SIEMPRE el archivo, y el operador ve qué se tomó. Cualquier otra
 * instrucción (por ejemplo «solo corrige los nombres») la sigue decidiendo la IA.
 */
import { normalizar, sinExtension } from './relectura-archivos-ignorados';

export interface DocumentoConOc {
  nombre: string;
  oc: string | null;
}

export interface AlcanceArchivo {
  /** Números de pedido de los archivos elegidos, normalizados. */
  ocs: ReadonlySet<string>;
  nombres: string[];
  /** Frase para el operador: qué se tomó como límite. */
  descripcion: string;
}

const LARGO_MINIMO_FRAGMENTO = 3;
const SOLO_X =
  /^(?:solo|solamente|unicamente|nada\s+mas\s+que)\s+(?:(?:tomar|toma|tomes)\s+en\s+cuenta\s+|(?:considera(?:r)?|lee(?:r)?|usa(?:r)?)\s+)?(?:(?:el|la|los|las)\s+)?(?:(?:archivo|pdf|documento|adjunto)s?\s+)?(.+?)[.!\s]*$/;

export function normalizarOc(valor: string | null | undefined): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function alcanceSoloArchivo(
  instruccion: string | undefined,
  documentos: readonly DocumentoConOc[],
): AlcanceArchivo | null {
  if (!instruccion?.trim() || documentos.length < 2) return null;

  const resto = SOLO_X.exec(normalizar(instruccion))?.[1];
  if (!resto) return null;
  const fragmentos = resto
    .split(/\s*(?:,|\by\b|\be\b)\s*/)
    .map((fragmento) => sinExtension(fragmento).trim())
    .filter(Boolean);
  if (
    fragmentos.length === 0 ||
    fragmentos.some((fragmento) => fragmento.length < LARGO_MINIMO_FRAGMENTO)
  ) {
    return null;
  }

  const elegidos = new Set<DocumentoConOc>();
  for (const fragmento of fragmentos) {
    // Todo lo escrito debe ser un archivo; si no, no es «solo un archivo».
    const coincidencias = documentos.filter((documento) =>
      normalizar(sinExtension(documento.nombre)).includes(fragmento),
    );
    if (coincidencias.length === 0) return null;
    for (const documento of coincidencias) elegidos.add(documento);
  }
  // Sin OC no se puede decir qué diferencias son del archivo; y si son todos, no limita.
  if (elegidos.size >= documentos.length) return null;
  if ([...elegidos].some((documento) => !normalizarOc(documento.oc))) return null;

  const nombres = [...elegidos].map((documento) => documento.nombre);
  const ocs = new Set([...elegidos].map((documento) => normalizarOc(documento.oc)));
  return {
    ocs,
    nombres,
    descripcion: `Tu instrucción se tomó como el archivo ${nombres.join(' y ')}: solo se tocan las diferencias de ese archivo y el resto de la orden queda como está.`,
  };
}
