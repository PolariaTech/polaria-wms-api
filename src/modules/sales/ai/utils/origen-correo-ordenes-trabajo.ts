/**
 * Agrupa renglones de origen_correo en órdenes de trabajo (hijas) de una OV.
 *
 * Clave = Numero pedido + Almacen (centro de consumo).
 * Así un mismo PO con varios almacenes (AVA) genera varias hijas,
 * y varios PO con el mismo almacén (Marina) también.
 */

export interface OrigenCorreoRenglon {
  Fecha?: string;
  Unidad?: string;
  Almacen?: string;
  Horario?: string;
  Cantidad?: number | string;
  Producto?: string;
  /** Precio unitario del documento (si venía en el PDF/correo). */
  Precio?: number | string;
  "Numero correo"?: string;
  "Numero pedido"?: string;
  "Nombre cliente"?: string;
  "Numero almacen"?: string;
  "Codigo producto"?: string;
  "Referencia pedido"?: string;
  "Responsable externo"?: string;
  "Responsable interno"?: string;
  "Referencia del cliente"?: string;
  "Ventana desde"?: string;
  "Ventana hasta"?: string;
  Destino?: string;
  "Direccion entrega"?: string;
  Anden?: string;
  "Telefono contacto"?: string;
  Prioridad?: string;
  "Notas generales"?: string;
  /** Índice en el array original / vínculo con línea del formulario. */
  _lineaIndex?: number;
}

export interface OrdenTrabajoHija {
  id: string;
  label: string;
  numeroPedido: string;
  almacen: string;
  referenciaPedido: string;
  fecha: string;
  responsableExterno: string;
  renglones: OrigenCorreoRenglon[];
  totalCantidad: number;
}

function norm(value: string | null | undefined): string {
  return (value ?? "").toString().trim();
}

function normKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCantidad(value: number | string | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(",", ".").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function groupKeyOrigenCorreo(renglon: OrigenCorreoRenglon): string {
  const pedido = norm(renglon["Numero pedido"]);
  const almacen = norm(renglon.Almacen);
  const referencia = norm(renglon["Referencia pedido"]);

  if (pedido || almacen) {
    return `pedido:${pedido ? normKey(pedido) : "_"}|almacen:${almacen ? normKey(almacen) : "_"}`;
  }
  if (referencia) return `ref:${normKey(referencia)}`;
  return "default";
}

function labelFromGroup(
  key: string,
  renglones: OrigenCorreoRenglon[],
): string {
  const first = renglones[0];
  if (!first) return "Orden de trabajo";
  const pedido = norm(first["Numero pedido"]);
  const ref = norm(first["Referencia pedido"]);
  const almacen = norm(first.Almacen);

  let destino = almacen;
  if (!destino && ref) {
    const m = ref.match(/FYV\s+(.+?)\s+PARA\s+ENTREGA/i);
    destino = m?.[1]?.trim() || ref;
  }

  if (pedido && destino) return `${pedido} — ${destino}`;
  if (destino) return destino;
  if (pedido) return pedido;
  if (key === "default") return "Orden de trabajo";
  return key.replace(/^(pedido|almacen|ref):/, "");
}

export function groupOrigenCorreoToOrdenesTrabajo(
  renglones: readonly OrigenCorreoRenglon[] | null | undefined,
): OrdenTrabajoHija[] {
  if (!renglones || renglones.length === 0) return [];

  const buckets = new Map<string, OrigenCorreoRenglon[]>();
  for (const row of renglones) {
    const key = groupKeyOrigenCorreo(row);
    const list = buckets.get(key);
    if (list) list.push(row);
    else buckets.set(key, [row]);
  }

  const hijas: OrdenTrabajoHija[] = [];
  for (const [key, rows] of buckets) {
    const first = rows[0]!;
    hijas.push({
      id: key,
      label: labelFromGroup(key, rows),
      numeroPedido: norm(first["Numero pedido"]),
      almacen: norm(first.Almacen),
      referenciaPedido: norm(first["Referencia pedido"]),
      fecha: norm(first.Fecha),
      responsableExterno: norm(first["Responsable externo"]),
      renglones: rows,
      totalCantidad: rows.reduce(
        (sum, row) => sum + parseCantidad(row.Cantidad),
        0,
      ),
    });
  }

  return hijas.sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function isOrigenCorreoArray(value: unknown): value is OrigenCorreoRenglon[] {
  return Array.isArray(value);
}

export function parseOrigenCorreoJson(
  value: unknown,
): OrigenCorreoRenglon[] {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return isOrigenCorreoArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return isOrigenCorreoArray(value) ? value : [];
}

/** Normaliza la clave OT usada en QR / captura. */
export function normalizeIdOrdenTrabajo(
  value: string | null | undefined,
): string {
  return (value ?? "").trim();
}
