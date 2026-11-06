import type { OrigenCorreoRenglon } from './origen-correo-ordenes-trabajo';

/**
 * REQ-262 / REQ-273: criterios por los que Reorganizar puede partir una orden de venta.
 * La ingesta no usa esto: ella separa por día y orden de compra al leer el correo.
 */
export const CRITERIOS_DIVISION = ['oc', 'dia', 'horario'] as const;
export type CriterioDivision = (typeof CRITERIOS_DIVISION)[number];

function texto(valor: unknown): string {
  const crudo =
    typeof valor === 'string' || typeof valor === 'number' ? String(valor) : '';
  return crudo.trim().replace(/\s+/g, ' ');
}

/** Clave comparable de una orden de compra: sin espacios sobrantes ni mayúsculas. */
export function claveOc(valor: unknown): string {
  return texto(valor).toUpperCase();
}

/** Día de entrega: `AAAA-MM-DD` si la fecha lo trae; si no, el texto en mayúsculas. */
export function claveDia(valor: unknown): string {
  const fecha = texto(valor);
  return /^\d{4}-\d{2}-\d{2}/.exec(fecha)?.[0] ?? fecha.toUpperCase();
}

export function claveHorario(valor: unknown): string {
  return texto(valor).toUpperCase();
}

/**
 * Horario de una fila del correo: la ventana «desde - hasta» si la trae y, si no, el
 * texto de «Horario». La web arma el mismo texto para sus tareas.
 */
export function horarioDeFila(fila: OrigenCorreoRenglon): string {
  const ventana = [fila['Ventana desde'], fila['Ventana hasta']]
    .map(texto)
    .filter((parte) => parte.length > 0);
  return ventana.length > 0 ? ventana.join(' - ') : texto(fila.Horario);
}

export function claveDeValor(criterio: CriterioDivision, valor: unknown): string {
  if (criterio === 'oc') return claveOc(valor);
  return criterio === 'dia' ? claveDia(valor) : claveHorario(valor);
}

/** Clave de una fila del correo para el criterio. Vacía si la fila no trae el dato. */
export function claveDeFila(
  criterio: CriterioDivision,
  fila: OrigenCorreoRenglon,
): string {
  if (criterio === 'oc') return claveOc(fila['Numero pedido']);
  return criterio === 'dia' ? claveDia(fila.Fecha) : claveHorario(horarioDeFila(fila));
}

/** Texto que se le muestra al operador para un valor del criterio. */
export function valorVisible(criterio: CriterioDivision, valor: unknown): string {
  return criterio === 'dia' ? claveDia(valor) : texto(valor);
}
