/**
 * POL-414 · Filtro por archivo de la relectura, en código y sin IA.
 *
 * «Ignora el archivo X» se resuelve ANTES de leer, por nombre de archivo: lo que la
 * instrucción pide ignorar no llega al lector. La instrucción es texto del usuario y aquí
 * solo se compara contra los nombres de los archivos de la propia orden; nunca se ejecuta.
 */

const VERBOS_IGNORAR =
  /\b(?:ignora(?:r|s)?|omite(?:s)?|omitir|salta(?:r|te)?|descarta(?:r|s)?|no\s+(?:leas|lea|tomes|uses|consideres|incluyas|tengas\s+en\s+cuenta))\b/gi;
const PALABRA_ARCHIVO = /\b(?:archivos?|pdfs?|documentos?|adjuntos?)\b/i;
/** Un fragmento más corto que esto coincidiría con casi cualquier nombre. */
const LARGO_MINIMO_FRAGMENTO = 3;

export function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[«»"'“”‘’`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sinExtension(nombre: string): string {
  return nombre.replace(/\.[a-z0-9]{2,5}$/i, '');
}

/** Frase de la instrucción que sigue al verbo, hasta el fin de la oración. */
function frasesDespuesDelVerbo(instruccion: string): string[] {
  const frases: string[] = [];
  for (const coincidencia of instruccion.matchAll(VERBOS_IGNORAR)) {
    const desde = (coincidencia.index ?? 0) + coincidencia[0].length;
    // El punto de «archivo.pdf» no termina la oración: sí lo hace «. » + mayúscula.
    const resto = instruccion.slice(desde);
    const fin = resto.search(/[;\n]|\.\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/);
    frases.push(fin === -1 ? resto : resto.slice(0, fin));
  }
  return frases;
}

/**
 * Nombres de `nombres` que la instrucción pide ignorar. Si coincidieran TODOS no se
 * ignora ninguno (no quedaría nada que leer) y la instrucción sigue su camino normal.
 */
export function archivosAIgnorar(
  instruccion: string | undefined,
  nombres: readonly string[],
): string[] {
  if (!instruccion?.trim() || nombres.length < 2) return [];

  const ignorados = new Set<string>();
  for (const frase of frasesDespuesDelVerbo(instruccion)) {
    const palabra = PALABRA_ARCHIVO.exec(frase);
    if (!palabra) continue;
    const fraseNormalizada = normalizar(frase);
    const tras = normalizar(frase.slice(palabra.index + palabra[0].length));
    const fragmentos = tras
      .split(/\s*(?:,|\by\b|\be\b|\bni\b)\s*/)
      .map((fragmento) => sinExtension(fragmento).trim())
      .filter((fragmento) => fragmento.length >= LARGO_MINIMO_FRAGMENTO);

    for (const nombre of nombres) {
      const base = normalizar(sinExtension(nombre));
      if (!base) continue;
      const coincide =
        fraseNormalizada.includes(base) ||
        fragmentos.some(
          (fragmento) => base.includes(fragmento) || fragmento.includes(base),
        );
      if (coincide) ignorados.add(nombre);
    }
  }

  return ignorados.size >= nombres.length ? [] : [...ignorados];
}
