import { createHash } from 'node:crypto';

/**
 * Reagrupación de OT con IA (POL-390 / REQ-125).
 *
 * El modelo solo PROPONE: devuelve a qué OT va cada renglón usando referencias
 * opacas (`r1`, `OT-A`). Este módulo es la única fuente de verdad: reconstruye la
 * propuesta desde el estado base y rechaza todo lo que no sea mover renglones
 * completos entre OT existentes (o hacia OT nuevas). Nada de lo que escriba el
 * modelo llega al cliente salvo `etiquetaSugerida`, ya saneada.
 */

/** Largo máximo de cualquier texto que viaja al modelo o vuelve de él (R5, R8). */
export const MAX_TEXTO_REAGRUPACION = 60;

/**
 * Techos técnicos PROVISIONALES contra entradas desbordadas. No son límites de
 * producto: R13 de POL-390 los define después de las pruebas.
 */
export const TECHOS_PROVISIONALES_REAGRUPACION = {
  maxOts: 200,
  maxRenglones: 2000,
  maxInstruccion: 4000,
  maxHistorial: 20,
} as const;

const ETIQUETA_OT_NUEVA_POR_DEFECTO = 'Nueva orden de trabajo';
const PATRON_OT_NUEVA = /^NUEVA-\d+$/;
const ESCALA_CANTIDAD = 1_000_000;

export interface RenglonBase {
  renglonId: string;
  producto: string;
  cantidad: number | string;
  unidad?: string | null;
}

export interface OtBase {
  otId: string;
  etiqueta: string;
  almacen: string;
  numeroPedido: string;
  renglones: RenglonBase[];
}

export interface EstadoBase {
  ots: OtBase[];
}

/** Lo ÚNICO que se le envía al modelo (R5). */
export interface ContextoModelo {
  ots: Array<{
    ot: string;
    etiqueta: string;
    almacen: string;
    pedido: string;
    renglones: Array<{
      r: string;
      producto: string;
      cantidad: number;
      unidad: string;
    }>;
  }>;
}

export interface MapaOpaco {
  /** `OT-A` → otId real. */
  otPorRef: Map<string, string>;
  /** `r1` → renglonId real. */
  renglonPorRef: Map<string, string>;
}

export type CodigoEstadoBaseInvalido =
  | 'SIN_OTS'
  | 'SIN_RENGLONES'
  | 'DEMASIADAS_OTS'
  | 'DEMASIADOS_RENGLONES'
  | 'OT_DUPLICADA'
  | 'OT_RESERVADA'
  | 'RENGLON_DUPLICADO'
  | 'CANTIDAD_INVALIDA';

export type MotivoRechazo =
  | 'SALIDA_NO_VALIDA'
  | 'RENGLONES_NO_COINCIDEN'
  | 'OT_INEXISTENTE'
  | 'OT_DUPLICADA'
  | 'TOTALES_NO_COINCIDEN';

export interface OtPropuesta {
  /** Id de una OT existente; null si es una OT nueva. */
  otId: string | null;
  /** `NUEVA-n` para OT nuevas; null si es existente. */
  nuevaClave: string | null;
  etiquetaSugerida: string | null;
  renglonIds: string[];
}

export interface PropuestaValidada {
  ots: OtPropuesta[];
  resumen: {
    antes: number;
    despues: number;
    nuevas: number;
    vacias: number;
  };
  movimientos: Array<{ renglonId: string; deOtId: string; aOtId: string }>;
}

export type ResultadoSalidaModelo =
  | { tipo: 'propuesta'; propuesta: PropuestaValidada }
  | { tipo: 'sin_cambios' }
  | { tipo: 'aclaracion' }
  | { tipo: 'rechazo' }
  | { tipo: 'invalida'; motivo: MotivoRechazo };

/** Caracteres de control, separadores de línea y de ancho cero. */
function esCaracterInvisible(codigo: number): boolean {
  return (
    codigo <= 0x1f ||
    (codigo >= 0x7f && codigo <= 0x9f) ||
    (codigo >= 0x200b && codigo <= 0x200f) ||
    codigo === 0x2028 ||
    codigo === 0x2029 ||
    codigo === 0xfeff
  );
}

/** Quita caracteres de control y marcado, colapsa espacios y recorta por puntos de código. */
export function sanitizarTextoCorto(
  valor: unknown,
  max: number = MAX_TEXTO_REAGRUPACION,
): string {
  if (typeof valor !== 'string') return '';
  const limpio = Array.from(valor, (caracter) =>
    esCaracterInvisible(caracter.codePointAt(0) ?? 0) ? ' ' : caracter,
  )
    .join('')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(limpio).slice(0, max).join('');
}

function parseCantidad(valor: number | string | null | undefined): number {
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string' && valor.trim() !== '') {
    return Number(valor.replace(',', '.').trim());
  }
  return Number.NaN;
}

function aEscala(cantidad: number): bigint {
  return BigInt(Math.round(cantidad * ESCALA_CANTIDAD));
}

function refOt(indice: number): string {
  let restante = indice;
  let letras = '';
  do {
    letras = String.fromCharCode(65 + (restante % 26)) + letras;
    restante = Math.floor(restante / 26) - 1;
  } while (restante >= 0);
  return `OT-${letras}`;
}

/** Revisa la estructura que manda el cliente. Devuelve el primer problema o null. */
export function validarEstadoBase(
  estado: EstadoBase,
): CodigoEstadoBaseInvalido | null {
  const { ots } = estado;
  if (ots.length === 0) return 'SIN_OTS';
  if (ots.length > TECHOS_PROVISIONALES_REAGRUPACION.maxOts) {
    return 'DEMASIADAS_OTS';
  }

  const otIds = new Set<string>();
  const renglonIds = new Set<string>();
  for (const ot of ots) {
    if (PATRON_OT_NUEVA.test(ot.otId)) return 'OT_RESERVADA';
    if (otIds.has(ot.otId)) return 'OT_DUPLICADA';
    otIds.add(ot.otId);

    for (const renglon of ot.renglones) {
      if (renglonIds.has(renglon.renglonId)) return 'RENGLON_DUPLICADO';
      renglonIds.add(renglon.renglonId);
      const cantidad = parseCantidad(renglon.cantidad);
      if (!Number.isFinite(cantidad) || cantidad < 0) {
        return 'CANTIDAD_INVALIDA';
      }
    }
  }

  if (renglonIds.size === 0) return 'SIN_RENGLONES';
  if (renglonIds.size > TECHOS_PROVISIONALES_REAGRUPACION.maxRenglones) {
    return 'DEMASIADOS_RENGLONES';
  }
  return null;
}

/**
 * Arma lo que ve el modelo: referencias opacas y solo almacén, pedido, producto y
 * cantidad, con textos truncados. No viaja correo, adjuntos, notas, comprador ni
 * teléfonos (R5): los campos se eligen uno por uno, nunca se copia el objeto.
 */
export function construirContextoModelo(estado: EstadoBase): {
  contexto: ContextoModelo;
  mapa: MapaOpaco;
} {
  const mapa: MapaOpaco = {
    otPorRef: new Map(),
    renglonPorRef: new Map(),
  };
  let contadorRenglon = 0;

  const ots = estado.ots.map((ot, indiceOt) => {
    const ref = refOt(indiceOt);
    mapa.otPorRef.set(ref, ot.otId);
    return {
      ot: ref,
      etiqueta: sanitizarTextoCorto(ot.etiqueta),
      almacen: sanitizarTextoCorto(ot.almacen),
      pedido: sanitizarTextoCorto(ot.numeroPedido),
      renglones: ot.renglones.map((renglon) => {
        contadorRenglon += 1;
        const refRenglon = `r${contadorRenglon}`;
        mapa.renglonPorRef.set(refRenglon, renglon.renglonId);
        return {
          r: refRenglon,
          producto: sanitizarTextoCorto(renglon.producto),
          cantidad: parseCantidad(renglon.cantidad),
          unidad: sanitizarTextoCorto(renglon.unidad ?? '', 10),
        };
      }),
    };
  });

  return { contexto: { ots }, mapa };
}

/** Hash estable (sin importar el orden) del estado que el cliente mandó. */
export function calcularBaseHash(estado: EstadoBase): string {
  const canonico = [...estado.ots]
    .sort((otA, otB) => otA.otId.localeCompare(otB.otId))
    .map((ot) => ({
      otId: ot.otId,
      etiqueta: ot.etiqueta,
      almacen: ot.almacen,
      numeroPedido: ot.numeroPedido,
      renglones: [...ot.renglones]
        .sort((renglonA, renglonB) =>
          renglonA.renglonId.localeCompare(renglonB.renglonId),
        )
        .map((renglon) => ({
          renglonId: renglon.renglonId,
          producto: renglon.producto,
          cantidad: aEscala(parseCantidad(renglon.cantidad)).toString(),
          unidad: renglon.unidad ?? '',
        })),
    }));
  return createHash('sha256').update(JSON.stringify(canonico)).digest('hex');
}

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function clavesExactas(
  objeto: Record<string, unknown>,
  esperadas: readonly string[],
): boolean {
  const claves = Object.keys(objeto).sort();
  const ordenadas = [...esperadas].sort();
  return (
    claves.length === ordenadas.length &&
    claves.every((clave, i) => clave === ordenadas[i])
  );
}

const salidaInvalida = (motivo: MotivoRechazo): ResultadoSalidaModelo => ({
  tipo: 'invalida',
  motivo,
});

/**
 * Valida la salida cruda del modelo contra el estado base y reconstruye la
 * propuesta. Reglas (R7): cada renglón base aparece exactamente una vez, solo
 * hay OT existentes o `NUEVA-n`, los totales no cambian y no hay campos extra.
 */
export function validarSalidaModelo(
  salida: unknown,
  estado: EstadoBase,
  mapa: MapaOpaco,
): ResultadoSalidaModelo {
  if (
    !esObjetoPlano(salida) ||
    !clavesExactas(salida, ['resultado', 'ots']) ||
    !Array.isArray(salida.ots)
  ) {
    return salidaInvalida('SALIDA_NO_VALIDA');
  }

  if (salida.resultado === 'aclaracion') return { tipo: 'aclaracion' };
  if (salida.resultado === 'rechazo') return { tipo: 'rechazo' };
  if (salida.resultado !== 'propuesta')
    return salidaInvalida('SALIDA_NO_VALIDA');

  // Índices del estado base.
  const otBasePorId = new Map(estado.ots.map((ot) => [ot.otId, ot]));
  const renglonBase = new Map<
    string,
    { renglon: RenglonBase; otId: string; orden: number }
  >();
  let orden = 0;
  for (const ot of estado.ots) {
    for (const renglon of ot.renglones) {
      renglonBase.set(renglon.renglonId, {
        renglon,
        otId: ot.otId,
        orden: orden++,
      });
    }
  }

  const refsOtVistas = new Set<string>();
  const renglonesVistos = new Set<string>();
  const finales: Array<{
    otId: string | null;
    nuevaClave: string | null;
    etiquetaSugerida: string | null;
    renglonIds: string[];
  }> = [];

  for (const item of salida.ots) {
    if (
      !esObjetoPlano(item) ||
      !clavesExactas(item, ['ot', 'etiquetaSugerida', 'renglones']) ||
      typeof item.ot !== 'string' ||
      !Array.isArray(item.renglones) ||
      !(
        item.etiquetaSugerida === null ||
        typeof item.etiquetaSugerida === 'string'
      )
    ) {
      return salidaInvalida('SALIDA_NO_VALIDA');
    }

    const refOtItem = item.ot;
    const otIdExistente = mapa.otPorRef.get(refOtItem) ?? null;
    const esNueva = PATRON_OT_NUEVA.test(refOtItem);
    if (!otIdExistente && !esNueva) return salidaInvalida('OT_INEXISTENTE');
    if (refsOtVistas.has(refOtItem)) return salidaInvalida('OT_DUPLICADA');
    refsOtVistas.add(refOtItem);

    const renglonIds: string[] = [];
    for (const ref of item.renglones) {
      if (typeof ref !== 'string') return salidaInvalida('SALIDA_NO_VALIDA');
      const renglonId = mapa.renglonPorRef.get(ref);
      if (!renglonId || renglonesVistos.has(renglonId)) {
        return salidaInvalida('RENGLONES_NO_COINCIDEN');
      }
      renglonesVistos.add(renglonId);
      renglonIds.push(renglonId);
    }

    finales.push({
      otId: otIdExistente,
      nuevaClave: otIdExistente ? null : refOtItem,
      etiquetaSugerida: otIdExistente
        ? null
        : sanitizarTextoCorto(item.etiquetaSugerida) ||
          ETIQUETA_OT_NUEVA_POR_DEFECTO,
      renglonIds,
    });
  }

  if (renglonesVistos.size !== renglonBase.size) {
    return salidaInvalida('RENGLONES_NO_COINCIDEN');
  }

  // Los totales se recalculan desde el estado base (defensa en profundidad).
  let totalBase = 0n;
  for (const { renglon } of renglonBase.values()) {
    totalBase += aEscala(parseCantidad(renglon.cantidad));
  }
  let totalFinal = 0n;
  for (const final of finales) {
    for (const renglonId of final.renglonIds) {
      totalFinal += aEscala(
        parseCantidad(renglonBase.get(renglonId)!.renglon.cantidad),
      );
    }
  }
  if (totalBase !== totalFinal) return salidaInvalida('TOTALES_NO_COINCIDEN');

  // Orden estable: OT existentes en su orden original, luego las nuevas.
  const posicionOt = new Map(estado.ots.map((ot, indice) => [ot.otId, indice]));
  const conRenglones = finales
    .filter((final) => final.renglonIds.length > 0)
    .map((final) => ({
      ...final,
      renglonIds: [...final.renglonIds].sort(
        (idA, idB) => renglonBase.get(idA)!.orden - renglonBase.get(idB)!.orden,
      ),
    }))
    .sort((otA, otB) => {
      const posicionA = otA.otId
        ? posicionOt.get(otA.otId)!
        : Number.MAX_SAFE_INTEGER;
      const posicionB = otB.otId
        ? posicionOt.get(otB.otId)!
        : Number.MAX_SAFE_INTEGER;
      if (posicionA !== posicionB) return posicionA - posicionB;
      return (otA.nuevaClave ?? '').localeCompare(otB.nuevaClave ?? '', 'es', {
        numeric: true,
      });
    });

  const movimientos: PropuestaValidada['movimientos'] = [];
  for (const final of conRenglones) {
    const destino = final.otId ?? final.nuevaClave!;
    for (const renglonId of final.renglonIds) {
      const origen = renglonBase.get(renglonId)!.otId;
      if (origen !== destino) {
        movimientos.push({ renglonId, deOtId: origen, aOtId: destino });
      }
    }
  }
  movimientos.sort(
    (movimientoA, movimientoB) =>
      renglonBase.get(movimientoA.renglonId)!.orden -
      renglonBase.get(movimientoB.renglonId)!.orden,
  );

  const nuevas = conRenglones.filter((final) => final.nuevaClave).length;
  const idsConservados = new Set(
    conRenglones.map((final) => final.otId).filter((id): id is string => !!id),
  );
  const vacias = [...otBasePorId.keys()].filter(
    (id) => !idsConservados.has(id),
  ).length;

  if (movimientos.length === 0 && nuevas === 0 && vacias === 0) {
    return { tipo: 'sin_cambios' };
  }

  return {
    tipo: 'propuesta',
    propuesta: {
      ots: conRenglones,
      resumen: {
        antes: estado.ots.length,
        despues: conRenglones.length,
        nuevas,
        vacias,
      },
      movimientos,
    },
  };
}
