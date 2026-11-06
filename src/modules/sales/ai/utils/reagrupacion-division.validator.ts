import type { EstadoBase } from './reagrupacion-ot.validator';

/** REQ-262 / REQ-273: partir la OV en una orden por orden de compra. */
export interface DivisionValidada {
  /** OC (tal como están en el estado) que salen a una OV nueva cada una. */
  ocSalen: string[];
  /** OC que se quedan en la OV actual. */
  ocQuedan: string[];
  /** OT del estado que viajan a las OV nuevas. */
  otIdsQueSalen: string[];
}

export type ResultadoDivision =
  | { tipo: 'division'; division: DivisionValidada }
  | { tipo: 'invalida'; motivo: 'OT_INEXISTENTE' | 'SALIDA_NO_VALIDA' };

/** Clave comparable de una orden de compra: sin espacios sobrantes ni mayúsculas. */
export function claveOc(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * La división solo puede nombrar OC que existen en el estado, al menos una debe
 * salir y al menos una debe quedarse. El modelo no puede inventar OC.
 */
export function validarDivision(
  ocSalenModelo: readonly string[],
  estado: EstadoBase,
): ResultadoDivision {
  const ocPorClave = new Map<string, string>();
  for (const ot of estado.ots) {
    const clave = claveOc(ot.numeroPedido);
    if (clave && !ocPorClave.has(clave)) {
      ocPorClave.set(clave, ot.numeroPedido.trim());
    }
  }

  const salen = new Set<string>();
  for (const oc of ocSalenModelo) {
    const clave = claveOc(oc);
    if (!ocPorClave.has(clave)) {
      return { tipo: 'invalida', motivo: 'OT_INEXISTENTE' };
    }
    salen.add(clave);
  }
  if (salen.size === 0 || salen.size >= ocPorClave.size) {
    return { tipo: 'invalida', motivo: 'SALIDA_NO_VALIDA' };
  }

  return {
    tipo: 'division',
    division: {
      ocSalen: [...salen].map((clave) => ocPorClave.get(clave)!),
      ocQuedan: [...ocPorClave.keys()]
        .filter((clave) => !salen.has(clave))
        .map((clave) => ocPorClave.get(clave)!),
      otIdsQueSalen: estado.ots
        .filter((ot) => salen.has(claveOc(ot.numeroPedido)))
        .map((ot) => ot.otId),
    },
  };
}
