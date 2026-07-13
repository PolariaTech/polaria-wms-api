import type { FlujoOrdenTrabajo } from '../interfaces/operations.interfaces';

const FLUJOS_VALIDOS: readonly FlujoOrdenTrabajo[] = [
  'a_bodega',
  'a_salida',
  'revisar',
  'bodega_a_bodega',
  'a_procesamiento',
];

export function parseTipoFlujo(
  observaciones: string | null,
): FlujoOrdenTrabajo | null {
  if (!observaciones?.startsWith('flujo:')) {
    return null;
  }
  const value = observaciones.slice('flujo:'.length).split('|')[0]?.trim();
  if (FLUJOS_VALIDOS.includes(value as FlujoOrdenTrabajo)) {
    return value as FlujoOrdenTrabajo;
  }
  return null;
}

export function buildObservacionesFlujo(
  tipoFlujo: FlujoOrdenTrabajo,
  observaciones?: string,
): string {
  const base = `flujo:${tipoFlujo}`;
  const extra = observaciones?.trim();
  return extra ? `${base}|${extra}` : base;
}
