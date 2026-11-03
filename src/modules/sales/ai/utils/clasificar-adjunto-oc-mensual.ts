/**
 * REQ-244 — SEADUST / KRYSTAL adjuntan OC mensuales junto al Excel o al pedido
 * del día (cuerpo). Mateo no debe tomar cantidades de esas OC mensuales.
 */

const CLIENTES_OC_MENSUAL =
  /\b(seadust|krystal|cristal\s+grand|crystal\s+grand)\b/i;

// `_` cuenta como \w en JS: no usar solo \b (falla en OC_MENSUAL_….pdf).
const NOMBRE_OC_MENSUAL =
  /(?:^|[^a-z0-9])(mensual|monthly|oc[_\s.-]?mes(?:ual)?|orden[_\s.-]?mensual|pedido[_\s.-]?mensual|po[_\s.-]?mensual|compra[_\s.-]?del[_\s.-]?mes)(?=[^a-z0-9]|$)/i;

const CONTENIDO_OC_MENSUAL =
  /\b(orden\s+de\s+compra\s+mensual|pedido\s+mensual|oc\s+mensual|purchase\s+order\s+monthly|monthly\s+(?:purchase\s+)?order|vigencia\s+(?:del\s+)?mes|contrato\s+mensual)\b/i;

export type DocumentoOcMensual = {
  nombre: string;
  /** Texto extraído del adjunto (opcional; ayuda si el nombre no dice "mensual"). */
  contenido?: string | null;
};

/**
 * ¿El hilo/cliente es SEADUST o KRYSTAL (u alias Crystal/Cristal Grand)?
 */
export function esClienteOcMensualAdjunta(
  ...pistas: Array<string | null | undefined>
): boolean {
  const blob = pistas
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join("\n");
  if (!blob) return false;
  return CLIENTES_OC_MENSUAL.test(blob);
}

/**
 * ¿El adjunto parece una OC/pedido mensual (no el pedido operativo del día)?
 */
export function pareceOcMensualAdjunto(
  nombre: string,
  contenido?: string | null,
): boolean {
  const base = nombre.split(/→/).pop()?.trim() || nombre;
  if (NOMBRE_OC_MENSUAL.test(base)) return true;
  const snip = (contenido ?? "").slice(0, 4000);
  if (snip && CONTENIDO_OC_MENSUAL.test(snip)) return true;
  return false;
}

/**
 * Si el cliente es SEADUST/KRYSTAL y hay otra fuente operativa (Excel/PDF del día
 * o cuerpo con pedido), saca las OC mensuales de la lista a leer.
 * Si lo único que hay son mensuales, no las filtra (haría falta algo que leer).
 */
export function filtrarDocumentosOcMensual<T extends DocumentoOcMensual>(input: {
  pistasCliente: Array<string | null | undefined>;
  documentos: readonly T[];
  /** Hay cuerpo de correo / mensaje pegado usable como pedido del día. */
  tieneContextoPedido: boolean;
}): { aLeer: T[]; ignorados: T[] } {
  const docs = [...input.documentos];
  if (docs.length === 0) return { aLeer: docs, ignorados: [] };

  const nombres = docs.map((d) => d.nombre).join("\n");
  if (!esClienteOcMensualAdjunta(...input.pistasCliente, nombres)) {
    return { aLeer: docs, ignorados: [] };
  }

  const ignorados: T[] = [];
  const operativos: T[] = [];
  for (const doc of docs) {
    if (pareceOcMensualAdjunto(doc.nombre, doc.contenido)) {
      ignorados.push(doc);
    } else {
      operativos.push(doc);
    }
  }

  if (ignorados.length === 0) return { aLeer: docs, ignorados: [] };

  const hayOtraFuente =
    operativos.length > 0 || input.tieneContextoPedido;
  if (!hayOtraFuente) {
    return { aLeer: docs, ignorados: [] };
  }

  return { aLeer: operativos, ignorados };
}
