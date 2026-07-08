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

export const LAYOUT_TIPO_SALIDA = {
  codigo: 'SALIDA',
  nombre: 'Salida',
  esRecepcion: false,
  esAlmacenamiento: false,
  esPicking: true,
} as const;

export const LAYOUT_TIPO_PROCESAMIENTO = {
  codigo: 'PROCESAMIENTO',
  nombre: 'Procesamiento',
  esRecepcion: false,
  esAlmacenamiento: false,
  esPicking: false,
} as const;

export const LAYOUT_ZONA_INGRESO = {
  codigo: 'INGRESO',
  nombre: 'Zona de ingreso',
} as const;

export const LAYOUT_ZONA_ALMACEN = {
  codigo: 'ALMACEN',
  nombre: 'Almacenamiento',
} as const;

export const LAYOUT_ZONA_SALIDA = {
  codigo: 'SALIDA',
  nombre: 'Zona de salida',
} as const;

export const LAYOUT_ZONA_PROCESAMIENTO = {
  codigo: 'PROCESAMIENTO',
  nombre: 'Procesamiento',
} as const;

/** @deprecated Usar LAYOUT_ZONA_ALMACEN en bodegas nuevas */
export const LAYOUT_ZONA_GENERAL = {
  codigo: 'GENERAL',
  nombre: 'General',
} as const;

export const LAYOUT_SLOT_PREFIX = 'SLOT-';
export const LAYOUT_INGRESO_PREFIX = 'ING-';
export const LAYOUT_SALIDA_PREFIX = 'SAL-';
export const LAYOUT_PROCESAMIENTO_PREFIX = 'PROC-';

/** Capacidades fijas alineadas con el layout UI (estado-bodega-layout.ts). */
export const LAYOUT_INGRESO_SLOTS = 8;
export const LAYOUT_SALIDA_SLOTS = 8;
export const LAYOUT_PROCESAMIENTO_SLOTS = 4;

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

export function formatZoneSlotCodigo(
  prefix: string,
  index: number,
  totalSlots: number,
): string {
  const width = Math.max(2, String(totalSlots).length);
  return `${prefix}${String(index).padStart(width, '0')}`;
}
