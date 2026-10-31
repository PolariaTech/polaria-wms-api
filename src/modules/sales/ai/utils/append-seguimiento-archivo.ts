export type OrigenArchivoItem = {
  nombre: string;
  url?: string;
  path?: string;
  mime?: string;
  bytes?: number;
  resourceType?: string;
};

/** Nombre estable del .eml de seguimiento. No puede ser `correo.eml`. */
export function nombreArchivoSeguimiento(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
  return `seguimiento-${safe || 'correo'}.eml`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceItem(raw: unknown): OrigenArchivoItem | null {
  if (typeof raw === 'string') {
    const nombre = raw.trim();
    return nombre ? { nombre } : null;
  }
  if (!isRecord(raw)) return null;
  const nombre = String(raw.nombre ?? raw.name ?? '').trim();
  if (!nombre) return null;
  const url = String(raw.url ?? '').trim();
  const path = String(raw.path ?? '').trim();
  const mime = String(raw.mime ?? '').trim();
  const bytesRaw = raw.bytes;
  const bytes =
    typeof bytesRaw === 'number' && Number.isFinite(bytesRaw) ? bytesRaw : undefined;
  const resourceType = String(raw.resourceType ?? '').trim();
  return {
    nombre,
    ...(url ? { url } : {}),
    ...(path ? { path } : {}),
    ...(mime ? { mime } : {}),
    ...(bytes != null ? { bytes } : {}),
    ...(resourceType ? { resourceType } : {}),
  };
}

/** Lee `origen_archivos`: JSON de adjuntos, o el formato legado "a.pdf, b.jpg". */
export function parseOrigenArchivosLista(
  raw: string | null | undefined,
): OrigenArchivoItem[] {
  const text = (raw ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(coerceItem)
        .filter((row): row is OrigenArchivoItem => row != null);
    } catch {
      return [];
    }
  }
  return text
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((nombre) => ({ nombre }));
}

export function serializeOrigenArchivosLista(
  items: readonly OrigenArchivoItem[],
): string {
  return JSON.stringify(items);
}

/**
 * Agrega el seguimiento si ese nombre todavía no está.
 * Dos archivos llamados igual se quedan en uno: por eso el nombre ya viene distinto.
 */
export function appendSeguimientoArchivo(
  existing: readonly OrigenArchivoItem[],
  nuevo: OrigenArchivoItem,
): { items: OrigenArchivoItem[]; agregado: boolean } {
  const key = nuevo.nombre.trim().toLowerCase();
  if (
    existing.some((item) => item.nombre.trim().toLowerCase() === key)
  ) {
    return { items: [...existing], agregado: false };
  }
  return { items: [...existing, nuevo], agregado: true };
}
