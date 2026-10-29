/**
 * Corrige confusiones típicas de extracción:
 * - Columnas "Usuario" / IDs de centro de costo usados como OC/PO
 * - "Oc Generada" / OC real del documento ignorada
 *
 * Ejemplo Xcaret: Usuario=3672091 ≠ Oc Generada=4501056534.
 * Sin este paso, mismo PO + mismo almacén se parte en varias OTs.
 */

export type LineaConPedido = {
  numeroPedido: string | null;
  almacen: string | null;
  /** Si existía, se conserva; si unificamos y el pedido viejo era Usuario, se mueve aquí. */
  numeroAlmacen?: string | null;
};

const OC_LABEL_RE =
  /(?:oc\s*generada|o\.?\s*c\.?\s*generada|orden\s+de\s+compra(?:\s+del\s+cliente)?|n[úu]mero\s+de\s+(?:pedido|orden|oc)|(?:^|[\s|:;])(?:oc|po)(?:\s*(?:number|#|no\.?|n[º°]?))?)\s*[:#.\-\s|]*([A-Z0-9][A-Z0-9\-\/]{4,20})/gi;

/**
 * XPU HA / hoteles: "REQUISICION # 50179" O, en PDFs unpdf, "50179REQUISICION #"
 * (el número va ANTES del rótulo). NO usar el título "Requisición de Compra"
 * — engancha el Artículo (00001678).
 */
const REQUISICION_NUM_BEFORE_RE =
  /(\d{4,12})\s*requisici[oó]n\s*#/gi;
const REQUISICION_NUM_AFTER_RE =
  /requisici[oó]n\s*(?:(?:n[uú]mero|no\.?|n[º°])\s*|#|:)\s*[\r\n\s]*(\d{4,12})\b/gi;

const FILENAME_OC_RE = /^(\d{8,15})(?:[_\s.-]|$)/i;

/**
 * IDs de "Usuario" / centro suelen ser 6–8 dígitos (ej. 3672091).
 * Requisiciones hotel (~5 dígitos, ej. 50184) NO deben unificarse como Usuario.
 */
function looksLikeUsuarioId(value: string): boolean {
  return /^\d{6,8}$/.test(value.trim());
}

/** SKU / Artículo con ceros a la izquierda (ej. 00001678) — no es OCC. */
function looksLikeArticuloSku(value: string): boolean {
  const v = value.trim();
  return /^0{2,}\d+$/.test(v) || /^0+\d{5,}$/.test(v);
}

/** Basura típica de OCR/PDF (ej. "rAutorizado" cerca de columna Autoriza). */
export function isGarbageOcValue(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  if (!v) return true;
  if (/autoriz/i.test(v)) return true;
  if (looksLikeArticuloSku(v)) return true;
  if (/^(solicita|comentario|departamento|almacen|almacén)$/i.test(v)) {
    return true;
  }
  // Código de OC/PO casi siempre trae dígitos (salvo raros alfanuméricos cortos).
  if (!/\d/.test(v) && v.length < 10) return true;
  return false;
}

function looksLikeOcCode(value: string): boolean {
  const v = value.trim();
  if (!v || isGarbageOcValue(v)) return false;
  // SAP / Oc Generada suele ser 9–15 dígitos (no confundir con Usuario 5–8).
  if (/^\d{9,15}$/.test(v)) return true;
  if (/^[A-Z]{2,}\d{4,}$/i.test(v)) return true;
  return v.length >= 8 && /[A-Z0-9]/i.test(v);
}

function collectFromRequisicionLabels(sourceText: string): string[] {
  const hits: string[] = [];
  // Preferir número pegado ANTES del rótulo (orden real de unpdf en XPU HA).
  for (const match of sourceText.matchAll(REQUISICION_NUM_BEFORE_RE)) {
    const raw = (match[1] ?? "").trim();
    if (raw && !looksLikeArticuloSku(raw)) hits.push(raw);
  }
  for (const match of sourceText.matchAll(REQUISICION_NUM_AFTER_RE)) {
    const raw = (match[1] ?? "").trim();
    if (raw && !looksLikeArticuloSku(raw)) hits.push(raw);
  }
  return hits;
}

function collectFromLabels(sourceText: string): string[] {
  const hits: string[] = [];
  for (const match of sourceText.matchAll(OC_LABEL_RE)) {
    const raw = (match[1] ?? "").trim();
    if (!raw) continue;
    if (/^(generada|pedido|compra|number|no|cliente)$/i.test(raw)) continue;
    hits.push(raw);
  }
  return hits;
}

/**
 * OC incrustada en el nombre (`AGUACATES DE PUEBLA_4502987208_UNICO.pdf`): 9–12 dígitos
 * delimitados por no-dígitos. Se usa solo como contraste de la OC leída del contenido
 * (REQ-187); NO entra a `detectOrdenCompraFromSource`, donde una cifra suelta del
 * nombre (p. ej. una fecha o folio) ganaría sobre las etiquetas del documento.
 */
const FILENAME_OC_EMBEBIDA_RE = /(?:^|[^\d])(\d{9,12})(?=[^\d]|$)/;

export function ocDesdeNombreArchivo(nombre: string): string | null {
  const base = nombre.split(/[/\\]/).pop() ?? nombre;
  const inicio = base.match(FILENAME_OC_RE);
  if (inicio?.[1]) return inicio[1];
  const embebida = base.match(FILENAME_OC_EMBEBIDA_RE);
  return embebida?.[1] ?? null;
}

/** "No. Pedido 4502986931" del encabezado de un pedido de compra (SAP/Solaya y similares). */
const NO_PEDIDO_LABEL_RE = /\bn[oº°]\.?\s*pedido\s*:?\s*(\d{6,15})\b/gi;

/** Todas las OC distintas que el documento rotula como "No. Pedido", la más repetida primero. */
export function ocsDesdeEtiquetaPedido(texto: string): string[] {
  const conteo = new Map<string, number>();
  for (const match of texto.matchAll(NO_PEDIDO_LABEL_RE)) {
    const valor = match[1]!;
    conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
  }
  return [...conteo.entries()].sort((a, b) => b[1] - a[1]).map(([oc]) => oc);
}

function collectFromFilenames(fileNames: readonly string[]): string[] {
  const hits: string[] = [];
  for (const name of fileNames) {
    const base = name.split(/[/\\]/).pop() ?? name;
    const m = base.match(FILENAME_OC_RE);
    if (m?.[1]) hits.push(m[1]);
  }
  return hits;
}

/**
 * Frecuencia de tokens numéricos largos (Oc Generada repetida en tablas).
 * Ignora claves SAP tipo X200011700.
 */
function collectFrequentNumericOcs(sourceText: string): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const match of sourceText.matchAll(/\b(\d{9,15})\b/g)) {
    const v = match[1]!;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value.length - a.value.length);
}

/**
 * Detecta la OC/PO canónica del documento (texto + nombres de archivo).
 * Prioriza etiquetas explícitas y nombres tipo `4501056534_PEDIDO.pdf`.
 */
export function detectOrdenCompraFromSource(
  sourceText: string,
  fileNames: readonly string[] = [],
): string | null {
  const fromFiles = collectFromFilenames(fileNames);
  if (fromFiles[0]) return fromFiles[0];

  // Requisición # (XPU HA y similares) — aceptar 4–12 dígitos del rótulo explícito.
  const fromReq = collectFromRequisicionLabels(sourceText);
  if (fromReq.length > 0) {
    const counts = new Map<string, number>();
    for (const v of fromReq) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || b[0].length - a[0].length,
    );
    if (ranked[0]?.[0]) return ranked[0][0];
  }

  const fromLabels = collectFromLabels(sourceText);
  if (fromLabels.length > 0) {
    const counts = new Map<string, number>();
    for (const v of fromLabels) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || b[0].length - a[0].length,
    );
    const best = ranked[0]?.[0];
    if (best && looksLikeOcCode(best)) return best;
  }

  const frequent = collectFrequentNumericOcs(sourceText);
  const top = frequent[0];
  // Tabla Xcaret: la Oc Generada se repite en casi todas las filas.
  if (top && top.count >= 3 && looksLikeOcCode(top.value)) {
    return top.value;
  }

  return null;
}

function distinctAlmacenesForPedido(
  lineas: readonly LineaConPedido[],
  pedido: string,
): number {
  const set = new Set<string>();
  for (const l of lineas) {
    if ((l.numeroPedido ?? "").trim() !== pedido) continue;
    const a = (l.almacen ?? "").trim().toLowerCase();
    if (a) set.add(a);
  }
  return set.size;
}

/**
 * ¿Los numeroPedido de línea parecen IDs de Usuario y no la OC del documento?
 */
export function shouldUnifyNumeroPedidoToOc(
  lineas: readonly LineaConPedido[],
  ocCanonico: string,
): boolean {
  const oc = ocCanonico.trim();
  if (!oc) return false;

  const pedidos = lineas
    .map((l) => (l.numeroPedido ?? "").trim())
    .filter(Boolean);
  if (pedidos.length === 0) return true;

  const already = pedidos.filter((p) => p === oc).length;
  if (already === pedidos.length) return false;
  if (already >= Math.ceil(pedidos.length * 0.5)) return false;

  const distinct = new Set(pedidos);
  // Un solo pedido distinto y no es la OC → casi seguro mal mapeado.
  if (distinct.size === 1) {
    const only = [...distinct][0]!;
    return only !== oc && (looksLikeUsuarioId(only) || !looksLikeOcCode(only));
  }

  // Varios "pedidos" cortos, cada uno casi atado a un solo almacén (patrón Usuario).
  let spurious = 0;
  for (const p of distinct) {
    if (p === oc) continue;
    if (!looksLikeUsuarioId(p)) continue;
    if (distinctAlmacenesForPedido(lineas, p) <= 1) spurious += 1;
  }

  return spurious >= Math.max(2, Math.ceil(distinct.size * 0.5));
}

/**
 * Valor limpio para OCC / Numero pedido: descarta basura y, si hay texto fuente,
 * intenta REQUISICION # / Oc Generada.
 */
export function resolveOrdenCompraLimpia(
  raw: string | null | undefined,
  sourceText = "",
  fileNames: readonly string[] = [],
): string {
  const trimmed = (raw ?? "").trim();
  // Preferir siempre REQUISICIÓN # / Oc Generada del PDF si el raw parece Artículo.
  if (isGarbageOcValue(trimmed) || looksLikeArticuloSku(trimmed)) {
    const detected = detectOrdenCompraFromSource(sourceText, fileNames);
    if (detected) return detected;
    return "";
  }
  if (trimmed && looksLikeOcCode(trimmed)) {
    return trimmed;
  }
  if (trimmed && /^\d{4,15}$/.test(trimmed)) {
    return trimmed;
  }
  const detected = detectOrdenCompraFromSource(sourceText, fileNames);
  if (detected) return detected;
  if (trimmed) return trimmed;
  return "";
}

/** Reescribe Numero pedido basura en renglones de origen_correo. */
export function sanitizeOrigenCorreoNumeroPedido<
  T extends { "Numero pedido"?: string },
>(rows: readonly T[], sourceText = ""): T[] {
  const detected = detectOrdenCompraFromSource(sourceText);
  return rows.map((row) => {
    const raw = row["Numero pedido"]?.trim() || "";
    if (!isGarbageOcValue(raw)) return row;
    return { ...row, "Numero pedido": detected || "" };
  });
}

export function normalizeNumeroPedidoFields<T extends LineaConPedido>(input: {
  ordenCompraHotel: string | null;
  lineas: T[];
  sourceText: string;
  fileNames?: readonly string[];
}): { ordenCompraHotel: string | null; lineas: T[] } {
  const detected = detectOrdenCompraFromSource(
    input.sourceText,
    input.fileNames ?? [],
  );

  const hotel = (input.ordenCompraHotel ?? "").trim() || null;
  let ocCanonico = detected;

  // Si no hubo señal en fuente, pero el hotel parece OC real y las líneas traen usuarios…
  if (!ocCanonico && hotel && looksLikeOcCode(hotel)) {
    ocCanonico = hotel;
  }

  // Si el hotel parece Usuario/basura (ej. rAutorizado) y detectamos OC/requisición, preferimos la detectada.
  if (
    detected &&
    hotel &&
    (looksLikeUsuarioId(hotel) || isGarbageOcValue(hotel)) &&
    detected !== hotel
  ) {
    ocCanonico = detected;
  }

  if (!ocCanonico) {
    return {
      ordenCompraHotel: hotel && !isGarbageOcValue(hotel) ? hotel : null,
      lineas: input.lineas.map((l) => ({ ...l })),
    };
  }

  if (!shouldUnifyNumeroPedidoToOc(input.lineas, ocCanonico)) {
    // Aun sin unificar líneas, corrige cabecera si era Usuario o basura OCR.
    const ordenCompraHotel =
      hotel &&
      (looksLikeUsuarioId(hotel) || isGarbageOcValue(hotel)) &&
      detected
        ? detected
        : hotel && !isGarbageOcValue(hotel)
          ? hotel
          : detected;
    return {
      ordenCompraHotel,
      lineas: input.lineas.map((l) => {
        const prev = (l.numeroPedido ?? "").trim();
        if (isGarbageOcValue(prev)) {
          return { ...l, numeroPedido: ordenCompraHotel };
        }
        return { ...l };
      }),
    };
  }

  return {
    ordenCompraHotel: ocCanonico,
    lineas: input.lineas.map((l) => {
      const prev = (l.numeroPedido ?? "").trim();
      const prevAlmacen = (l.numeroAlmacen ?? "").trim();
      const moveUsuario =
        !prevAlmacen &&
        Boolean(prev) &&
        prev !== ocCanonico &&
        looksLikeUsuarioId(prev);
      return {
        ...l,
        numeroPedido: ocCanonico,
        ...(moveUsuario ? { numeroAlmacen: prev } : {}),
      };
    }),
  };
}
