import {
  CRITERIOS_DIVISION,
  claveDeValor,
  claveDia,
  claveHorario,
  claveOc,
  valorVisible,
  type CriterioDivision,
} from './claves-division';
import type { EstadoBase, OtBase } from './reagrupacion-ot.validator';

export { claveOc };

/** REQ-262 / REQ-273: partir la OV por orden de compra, día u horario de entrega. */
export interface DivisionValidada {
  criterio: CriterioDivision;
  /** Valores (tal como se muestran) que salen a una OV nueva cada uno. */
  valoresSalen: string[];
  /** Valores que se quedan juntos en la OV actual. */
  valoresQuedan: string[];
  /** OT del estado que viajan a las OV nuevas. */
  otIdsQueSalen: string[];
}

/** Lo que el modelo dijo, ya leído: el criterio y los valores que salen. */
export interface DivisionCruda {
  criterio: CriterioDivision | 'otro' | 'ninguno';
  valores: string[];
}

export type ResultadoDivision =
  | { tipo: 'division'; division: DivisionValidada }
  /** No se puede dividir: el criterio pedido no distingue nada, o no es uno de los tres. */
  | { tipo: 'imposible'; criterio: CriterioDivision | 'otro' }
  | { tipo: 'invalida'; motivo: 'OT_INEXISTENTE' | 'SALIDA_NO_VALIDA' };

const CRITERIOS_DEL_MODELO: readonly unknown[] = [
  ...CRITERIOS_DIVISION,
  'otro',
  'ninguno',
];

/**
 * Lee `criterio` y `valoresSalen` de la salida cruda del modelo. Solo con resultado
 * "division" puede haber valores. Devuelve null si la forma no es válida.
 */
export function leerDivisionCruda(
  salida: Record<string, unknown>,
  esDivision: boolean,
): DivisionCruda | null {
  const criterio = salida.criterio ?? 'ninguno';
  const valores: unknown = salida.valoresSalen ?? [];
  if (
    !CRITERIOS_DEL_MODELO.includes(criterio) ||
    !Array.isArray(valores) ||
    valores.some((valor) => typeof valor !== 'string') ||
    (!esDivision && valores.length > 0)
  ) {
    return null;
  }
  return {
    criterio: criterio as DivisionCruda['criterio'],
    valores: valores as string[],
  };
}

function claveDeOt(criterio: CriterioDivision, ot: OtBase): string {
  if (criterio === 'oc') return claveOc(ot.numeroPedido);
  return criterio === 'dia' ? claveDia(ot.fecha) : claveHorario(ot.horario);
}

function valorDeOt(criterio: CriterioDivision, ot: OtBase): string {
  const crudo = criterio === 'oc' ? ot.numeroPedido : criterio === 'dia' ? ot.fecha : ot.horario;
  return valorVisible(criterio, crudo);
}

/**
 * La división solo puede nombrar valores que existen en el estado. Hace falta que el
 * criterio distinga al menos dos valores (si no, no hay nada que separar), que salga al
 * menos uno y que se quede al menos uno. El modelo no puede inventar valores.
 */
export function validarDivision(
  cruda: DivisionCruda,
  estado: EstadoBase,
): ResultadoDivision {
  const { criterio } = cruda;
  if (criterio === 'otro' || criterio === 'ninguno') {
    return { tipo: 'imposible', criterio: 'otro' };
  }

  const visiblePorClave = new Map<string, string>();
  for (const ot of estado.ots) {
    const clave = claveDeOt(criterio, ot);
    if (clave && !visiblePorClave.has(clave)) {
      visiblePorClave.set(clave, valorDeOt(criterio, ot));
    }
  }
  if (visiblePorClave.size < 2) return { tipo: 'imposible', criterio };

  const salen = new Set<string>();
  for (const valor of cruda.valores) {
    const clave = claveDeValor(criterio, valor);
    if (!visiblePorClave.has(clave)) {
      return { tipo: 'invalida', motivo: 'OT_INEXISTENTE' };
    }
    salen.add(clave);
  }
  if (salen.size === 0 || salen.size >= visiblePorClave.size) {
    return { tipo: 'invalida', motivo: 'SALIDA_NO_VALIDA' };
  }

  return {
    tipo: 'division',
    division: {
      criterio,
      valoresSalen: [...salen].map((clave) => visiblePorClave.get(clave)!),
      valoresQuedan: [...visiblePorClave.keys()]
        .filter((clave) => !salen.has(clave))
        .map((clave) => visiblePorClave.get(clave)!),
      otIdsQueSalen: estado.ots
        .filter((ot) => salen.has(claveDeOt(criterio, ot)))
        .map((ot) => ot.otId),
    },
  };
}

const MENSAJES_IMPOSIBLE: Record<CriterioDivision | 'otro', string> = {
  oc: 'No puedo dividir la orden: todas sus tareas tienen la misma orden de compra.',
  dia: 'No puedo dividir la orden: todas sus tareas tienen el mismo día de entrega, o no lo tienen registrado.',
  horario:
    'No puedo dividir la orden: todas sus tareas tienen el mismo horario de entrega, o no lo tienen registrado.',
  otro: 'Solo puedo dividir una orden de venta por orden de compra, por día de entrega o por horario de entrega. Para sacar un producto suelto, muévelo a otra tarea o créalo en una orden nueva.',
};

/** Texto fijo del servidor (no del modelo) que explica por qué no se puede dividir. */
export function mensajeDivisionImposible(
  criterio: CriterioDivision | 'otro',
): string {
  return MENSAJES_IMPOSIBLE[criterio];
}
