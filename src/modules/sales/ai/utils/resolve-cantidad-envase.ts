/**
 * Convierte "N envases de X unidad" a la cantidad/precio de la unidad del catálogo.
 *
 * Ej.: "1 galón de 5 litros" + catálogo LTR + precio 350/envase
 *   → cantidad 5 LTR, precio unitario 70.
 */

export type FamiliaUnidad = "ltr" | "kg" | "pza" | "unknown";

export type EnvaseContenidoParseado = {
  /** Cuántos envases (galones, cubetas, cajas…). */
  envases: number;
  /** Contenido de cada envase en la unidad del contenido. */
  contenidoPorEnvase: number;
  familiaContenido: FamiliaUnidad;
  frase: string;
};

export type CantidadEnvaseResuelta = {
  cantidad: number;
  precioUnitario: number | null;
  envases: number;
  contenidoPorEnvase: number;
  familia: FamiliaUnidad;
  frase: string;
};

const ENVASE_NOMBRE =
  String.raw`galon(?:es)?|gal\.?|cubeta(?:s)?|bidon(?:es)?|garrafa(?:s)?|envase(?:s)?|botella(?:s)?|frasco(?:s)?|tarro(?:s)?|lata(?:s)?|saco(?:s)?|bolsa(?:s)?|pieza(?:s)?|pzas?|pza\.?|unidad(?:es)?|unds?|caja(?:s)?|cja\.?|packs?|bandeja(?:s)?`;

const CONTENIDO_UNIDAD =
  String.raw`litro(?:s)?|lts?\.?|l\.?|kg|kilos?|kgs?\.?|gramos?|grs?\.?|g\.?|ml|mililitros?|pieza(?:s)?|pzas?|pza\.?|unidad(?:es)?|unds?`;

const ENVASE_RE = new RegExp(
  String.raw`\b(\d+(?:[.,]\d+)?)\s*(${ENVASE_NOMBRE})\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(${CONTENIDO_UNIDAD})\b`,
  "i",
);

/** Sin número de envases al inicio: "galón de 5 litros". */
const ENVASE_SIN_N_RE = new RegExp(
  String.raw`\b(${ENVASE_NOMBRE})\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(${CONTENIDO_UNIDAD})\b`,
  "i",
);

function quitarAcentos(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function parseNum(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function approx(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.051;
}

function familiaDesdeToken(token: string): FamiliaUnidad {
  const t = quitarAcentos(token).replace(/\./g, "");
  if (
    /^(litros?|lts?|l)$/.test(t) ||
    t === "ml" ||
    t.startsWith("mililitro")
  ) {
    return "ltr";
  }
  if (/^(kg|kilos?|kgs?)$/.test(t)) return "kg";
  if (/^(gramos?|grs?|g)$/.test(t)) return "kg";
  if (/^(piezas?|pzas?|pza|unidades?|unds?)$/.test(t)) return "pza";
  return "unknown";
}

/** Normaliza ml→litros y g→kg en el número de contenido. */
function normalizarContenido(
  valor: number,
  tokenUnidad: string,
): { valor: number; familia: FamiliaUnidad } {
  const t = quitarAcentos(tokenUnidad).replace(/\./g, "");
  if (t === "ml" || t.startsWith("mililitro")) {
    return { valor: valor / 1000, familia: "ltr" };
  }
  if (/^(gramos?|grs?|g)$/.test(t)) {
    return { valor: valor / 1000, familia: "kg" };
  }
  return { valor, familia: familiaDesdeToken(tokenUnidad) };
}

/**
 * Familia de la unidad de medida del catálogo (LTR, KGM, PZA, kg, l, …).
 */
export function familiaUnidadCatalogo(
  unidadMedida: string | null | undefined,
): FamiliaUnidad {
  const u = quitarAcentos((unidadMedida ?? "").trim()).replace(/\./g, "");
  if (!u) return "unknown";
  if (
    u === "ltr" ||
    u === "l" ||
    u === "lt" ||
    u === "lts" ||
    u.startsWith("litro") ||
    u === "ml"
  ) {
    return "ltr";
  }
  if (
    u === "kgm" ||
    u === "kg" ||
    u === "k" ||
    u === "kgs" ||
    u.startsWith("kilo") ||
    u === "g" ||
    u.startsWith("gramo")
  ) {
    return "kg";
  }
  if (
    u === "pza" ||
    u === "pz" ||
    u === "pzas" ||
    u === "un" ||
    u === "uno" ||
    u === "und" ||
    u === "unds" ||
    u.startsWith("pieza") ||
    u.startsWith("unidad")
  ) {
    return "pza";
  }
  if (u === "cja" || u === "cj" || u.startsWith("caja")) {
    // Caja como UoM de catálogo ≈ pieza/envase; no convertir contenido→caja.
    return "pza";
  }
  return "unknown";
}

/**
 * Detecta "N envase de X unidad" (o "envase de X unidad") en el texto del cliente.
 */
export function parseEnvaseContenidoDesdeTexto(
  texto: string | null | undefined,
): EnvaseContenidoParseado | null {
  const original = (texto ?? "").trim();
  if (!original) return null;
  // Sin acentos para matchear galón/cubeta/etc. de forma estable.
  const raw = quitarAcentos(original);

  const m = ENVASE_RE.exec(raw);
  if (m) {
    const envases = parseNum(m[1]!);
    const contenidoRaw = parseNum(m[3]!);
    if (envases == null || contenidoRaw == null) return null;
    const { valor, familia } = normalizarContenido(contenidoRaw, m[4]!);
    if (familia === "unknown") return null;
    return {
      envases,
      contenidoPorEnvase: valor,
      familiaContenido: familia,
      frase: m[0]!,
    };
  }

  const m2 = ENVASE_SIN_N_RE.exec(raw);
  if (m2) {
    const contenidoRaw = parseNum(m2[2]!);
    if (contenidoRaw == null) return null;
    const { valor, familia } = normalizarContenido(contenidoRaw, m2[3]!);
    if (familia === "unknown") return null;
    return {
      envases: 1,
      contenidoPorEnvase: valor,
      familiaContenido: familia,
      frase: m2[0]!,
    };
  }

  return null;
}

/**
 * Si el catálogo vende en la misma familia que el contenido del envase,
 * convierte cantidad (a contenido) y precio (de por-envase a por-unidad).
 * No toca líneas ya convertidas.
 */
export function resolveCantidadPrecioDesdeEnvase(params: {
  textoOriginal: string | null | undefined;
  unidadMedidaCatalogo: string | null | undefined;
  /** Cantidad que trajo Mateo / origen (suele ser # de envases). */
  cantidadRaw: number | null | undefined;
  /** Precio del documento (casi siempre por envase/UN). */
  precioDoc: number | null | undefined;
}): CantidadEnvaseResuelta | null {
  const parsed = parseEnvaseContenidoDesdeTexto(params.textoOriginal);
  if (!parsed) return null;

  const familiaCat = familiaUnidadCatalogo(params.unidadMedidaCatalogo);
  if (familiaCat === "unknown" || familiaCat !== parsed.familiaContenido) {
    return null;
  }

  const cantidadRaw =
    params.cantidadRaw != null && Number.isFinite(params.cantidadRaw)
      ? params.cantidadRaw
      : null;

  const texto = quitarAcentos(params.textoOriginal ?? "");
  const patronConN = ENVASE_RE.test(texto);

  // Envases: N del texto; si el nombre solo dice "cubeta de 10 L" y la
  // cantidad cruda es el conteo de envases, usa esa cantidad.
  let envases = parsed.envases;
  if (!patronConN && cantidadRaw != null && approx(cantidadRaw, Math.round(cantidadRaw))) {
    const candidato = Math.round(cantidadRaw);
    if (
      candidato >= 1 &&
      !approx(candidato, parsed.contenidoPorEnvase) &&
      !approx(candidato, candidato * parsed.contenidoPorEnvase)
    ) {
      envases = candidato;
    }
  } else if (patronConN && cantidadRaw != null && approx(cantidadRaw, parsed.envases)) {
    envases = parsed.envases;
  } else if (patronConN) {
    envases = parsed.envases;
  }

  const cantidadObjetivo = roundQty(envases * parsed.contenidoPorEnvase);

  // Ya estaba en unidad de contenido → no re-convertir (evita 70/5 = 14).
  if (cantidadRaw != null && approx(cantidadRaw, cantidadObjetivo)) {
    return null;
  }

  // Solo convertimos si la cantidad cruda es # envases (o viene vacía).
  if (
    cantidadRaw != null &&
    !approx(cantidadRaw, envases) &&
    !(envases === 1 && approx(cantidadRaw, 1))
  ) {
    return null;
  }

  const precioDoc =
    params.precioDoc != null &&
    Number.isFinite(params.precioDoc) &&
    params.precioDoc > 0
      ? params.precioDoc
      : null;

  const precioUnitario =
    precioDoc != null
      ? roundQty(precioDoc / parsed.contenidoPorEnvase)
      : null;

  return {
    cantidad: cantidadObjetivo,
    precioUnitario,
    envases,
    contenidoPorEnvase: parsed.contenidoPorEnvase,
    familia: parsed.familiaContenido,
    frase: parsed.frase,
  };
}
