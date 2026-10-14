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

const FILENAME_OC_RE = /^(\d{8,15})(?:[_\s.-]|$)/i;

/** IDs de "Usuario" / centro suelen ser 5–8 dígitos; Oc Generada SAP suele ser más larga. */
function looksLikeUsuarioId(value: string): boolean {
  return /^\d{5,8}$/.test(value.trim());
}

function looksLikeOcCode(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^\d{9,15}$/.test(v)) return true;
  if (/^[A-Z]{2,}\d{4,}$/i.test(v)) return true;
  return v.length >= 8 && /[A-Z0-9]/i.test(v);
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

  // Si el hotel parece Usuario y detectamos Oc Generada, preferimos la detectada.
  if (detected && hotel && looksLikeUsuarioId(hotel) && detected !== hotel) {
    ocCanonico = detected;
  }

  if (!ocCanonico) {
    return {
      ordenCompraHotel: hotel,
      lineas: input.lineas.map((l) => ({ ...l })),
    };
  }

  if (!shouldUnifyNumeroPedidoToOc(input.lineas, ocCanonico)) {
    // Aun sin unificar líneas, corrige cabecera si era un Usuario.
    const ordenCompraHotel =
      hotel && looksLikeUsuarioId(hotel) && detected ? detected : hotel ?? detected;
    return {
      ordenCompraHotel,
      lineas: input.lineas.map((l) => ({ ...l })),
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
