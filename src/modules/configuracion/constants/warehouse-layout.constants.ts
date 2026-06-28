export const LAYOUT_TIPO_INGRESO = {
  codigo: 'INGRESO',
  nombre: 'Ingreso',
  esRecepcion: true,
  esAlmacenamiento: false,
  esPicking: false,
} as const;

export const LAYOUT_TIPO_ALMACEN = {
  codigo: 'ALMACEN',
  nombre: 'Almacén',
  esRecepcion: false,
  esAlmacenamiento: true,
  esPicking: false,
} as const;

export const LAYOUT_ZONA_GENERAL = {
  codigo: 'GENERAL',
  nombre: 'General',
} as const;

export const LAYOUT_SLOT_PREFIX = 'SLOT-';
export const LAYOUT_MIN_SLOTS = 1;
export const LAYOUT_MAX_SLOTS = 500;

export function resolveCapacidadSlots(
  capacidadSlots: number | null | undefined,
): number {
  const raw = capacidadSlots ?? LAYOUT_MIN_SLOTS;
  return Math.min(
    LAYOUT_MAX_SLOTS,
    Math.max(LAYOUT_MIN_SLOTS, Math.trunc(raw)),
  );
}

export function formatSlotCodigo(index: number, totalSlots: number): string {
  const width = Math.max(3, String(totalSlots).length);
  return `${LAYOUT_SLOT_PREFIX}${String(index).padStart(width, '0')}`;
}
