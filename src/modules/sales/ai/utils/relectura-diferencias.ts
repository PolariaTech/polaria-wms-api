/**
 * POL-414 · Diferencias entre la orden actual y lo que leyó la relectura.
 *
 * El CÓDIGO calcula y numera las diferencias; el modelo de reconciliación solo elige qué
 * hacer con cada una y no puede inventar renglones. Aplicar una decisión también es
 * código: el resultado sale de las filas reales (las actuales y las leídas), nunca de
 * texto que escriba el modelo.
 */
import type { OrigenCorreoRenglon } from './origen-correo-ordenes-trabajo';

export type TipoDiferencia = 'agregar' | 'quitar' | 'cambiar';

export interface DatosRenglon {
  producto: string;
  cantidad: string;
}

/** Lo que ve el modelo y, en lenguaje claro, el operador. */
export interface DiferenciaRelectura {
  id: number;
  tipo: TipoDiferencia;
  /** Pedido y almacén tal como los reconoce el operador (la OT). */
  numeroPedido: string;
  almacen: string;
  /** Lo que hay hoy en la orden (quitar y cambiar). */
  actual?: DatosRenglon;
  /** Lo que leyeron los documentos (agregar y cambiar). */
  leido?: DatosRenglon;
  /** quitar: el mismo renglón sigue en la lectura, así que en la orden está repetido. */
  repetidoEnActual?: boolean;
  /**
   * cambiar: el documento rotula este producto con OTRO almacén. Al aplicar solo se
   * corrige el nombre; el almacén de la orden no se mueve.
   */
  almacenLeido?: string;
}

export interface DiferenciaConFilas {
  publica: DiferenciaRelectura;
  filaActual?: OrigenCorreoRenglon;
  filaLeida?: OrigenCorreoRenglon;
}

/** Qué se le muestra al operador de una diferencia, en lenguaje que reconoce. */
export interface MotivoDiferencia {
  tipo: TipoDiferencia;
  /** La OT por su almacén y su pedido. */
  ot: string;
  /** Producto tal como lo reconoce el operador («actual → leído» si cambia). */
  producto: string;
  /** true: se aplicó a la propuesta; false: la orden queda como está. */
  aplicada: boolean;
  motivo: string;
}

const MOTIVO_POR_OMISION = 'Según lo que pediste.';

export function motivoDeDiferencia(
  diferencia: DiferenciaRelectura,
  aplicada: boolean,
  motivo: string,
): MotivoDiferencia {
  const { actual, leido } = diferencia;
  const producto =
    diferencia.tipo === 'cambiar'
      ? `${actual?.producto ?? ''} → ${leido?.producto ?? ''}`
      : (actual ?? leido)?.producto ?? '';
  const partes = [
    diferencia.almacen && `Almacén ${diferencia.almacen}`,
    diferencia.numeroPedido && `pedido ${diferencia.numeroPedido}`,
  ].filter(Boolean);
  return {
    tipo: diferencia.tipo,
    ot: partes.join(' · '),
    producto,
    aplicada,
    motivo: motivo.trim() || MOTIVO_POR_OMISION,
  };
}

/** Con más diferencias que esto no se pide decidir una por una. */
export const MAX_DIFERENCIAS_RECONCILIACION = 150;
/** Parecido mínimo entre dos nombres para tratarlos como el mismo renglón renombrado. */
const PARECIDO_MINIMO_NOMBRE = 0.3;
/** Sin el respaldo del almacén igual, se exige un nombre mucho más parecido. */
const PARECIDO_MINIMO_NOMBRE_OTRO_ALMACEN = 0.5;

function norm(valor: string | number | null | undefined): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function clave(renglon: OrigenCorreoRenglon): string {
  return [
    norm(renglon['Numero pedido']),
    norm(renglon.Almacen),
    norm(renglon.Producto),
    norm(renglon.Cantidad),
  ].join('|');
}

/** Mismo pedido, almacén y cantidad: solo cambia el nombre del producto. */
function claveSinProducto(renglon: OrigenCorreoRenglon): string {
  return [
    norm(renglon['Numero pedido']),
    norm(renglon.Almacen),
    norm(renglon.Cantidad),
  ].join('|');
}

function contar(renglones: readonly OrigenCorreoRenglon[]): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const renglon of renglones) {
    const k = clave(renglon);
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  return conteo;
}

/** Filas de `origen` que sobran respecto de `referencia` (multiconjuntos), en orden. */
function sobrantes(
  origen: readonly OrigenCorreoRenglon[],
  referencia: ReadonlyMap<string, number>,
): OrigenCorreoRenglon[] {
  const restante = new Map(referencia);
  const resultado: OrigenCorreoRenglon[] = [];
  for (const renglon of origen) {
    const k = clave(renglon);
    const disponibles = restante.get(k) ?? 0;
    if (disponibles > 0) restante.set(k, disponibles - 1);
    else resultado.push(renglon);
  }
  return resultado;
}

function bigramas(texto: string): string[] {
  const limpio = norm(texto).replace(/\s/g, '');
  const pares: string[] = [];
  for (let i = 0; i < limpio.length - 1; i += 1) {
    pares.push(limpio.slice(i, i + 2));
  }
  return pares;
}

/** Coeficiente de Dice sobre bigramas: 1 igual, 0 sin nada en común. */
function parecido(a: string, b: string): number {
  const paresA = bigramas(a);
  const paresB = bigramas(b);
  if (paresA.length === 0 || paresB.length === 0) return 0;
  const restantes = [...paresB];
  let comunes = 0;
  for (const par of paresA) {
    const posicion = restantes.indexOf(par);
    if (posicion !== -1) {
      comunes += 1;
      restantes.splice(posicion, 1);
    }
  }
  return (2 * comunes) / (paresA.length + paresB.length);
}

function datos(renglon: OrigenCorreoRenglon): DatosRenglon {
  return {
    producto: String(renglon.Producto ?? '').trim(),
    cantidad: String(renglon.Cantidad ?? '').trim(),
  };
}

function contexto(renglon: OrigenCorreoRenglon) {
  return {
    numeroPedido: String(renglon['Numero pedido'] ?? '').trim(),
    almacen: String(renglon.Almacen ?? '').trim(),
  };
}

/**
 * Diferencias numeradas (desde 1): primero los nombres cambiados, después lo que se
 * quitaría y lo que se agregaría. Un renglón quitado y otro agregado con el mismo pedido,
 * almacén y cantidad, y nombres parecidos, son UN cambio de nombre.
 */
export function calcularDiferencias(
  antes: readonly OrigenCorreoRenglon[],
  despues: readonly OrigenCorreoRenglon[],
): DiferenciaConFilas[] {
  const conteoAntes = contar(antes);
  const conteoDespues = contar(despues);
  const quitados = sobrantes(antes, conteoDespues);
  const agregados = sobrantes(despues, conteoAntes);

  const agregadosLibres = new Set(agregados);
  const cambios: Array<{
    actual: OrigenCorreoRenglon;
    leido: OrigenCorreoRenglon;
    almacenDistinto: boolean;
  }> = [];
  let quitadosSinPareja: OrigenCorreoRenglon[] = [];

  /** Mejor candidato libre que cumpla `compatible` con un nombre parecido ≥ `minimo`. */
  const mejorCandidato = (
    quitado: OrigenCorreoRenglon,
    compatible: (candidato: OrigenCorreoRenglon) => boolean,
    minimo: number,
  ): OrigenCorreoRenglon | null => {
    let mejor: OrigenCorreoRenglon | null = null;
    let mejorParecido = minimo;
    for (const candidato of agregadosLibres) {
      if (!compatible(candidato)) continue;
      const similitud = parecido(
        String(quitado.Producto ?? ''),
        String(candidato.Producto ?? ''),
      );
      if (similitud >= mejorParecido) {
        mejor = candidato;
        mejorParecido = similitud;
      }
    }
    return mejor;
  };

  // Un renglón que sigue en la lectura está repetido en la orden: nunca es un renombre.
  const estaRepetido = (quitado: OrigenCorreoRenglon) =>
    (conteoDespues.get(clave(quitado)) ?? 0) > 0;

  // 1.ª pasada: mismo pedido, almacén y cantidad.
  for (const quitado of quitados) {
    if (estaRepetido(quitado)) {
      quitadosSinPareja.push(quitado);
      continue;
    }
    const mejor = mejorCandidato(
      quitado,
      (candidato) => claveSinProducto(candidato) === claveSinProducto(quitado),
      PARECIDO_MINIMO_NOMBRE,
    );
    if (mejor) {
      agregadosLibres.delete(mejor);
      cambios.push({ actual: quitado, leido: mejor, almacenDistinto: false });
    } else {
      quitadosSinPareja.push(quitado);
    }
  }
  // 2.ª pasada: el documento rotula otro almacén, pero es el mismo producto con el
  // nombre alterado (mismo pedido y cantidad y un nombre muy parecido).
  const restantes: OrigenCorreoRenglon[] = [];
  for (const quitado of quitadosSinPareja) {
    if (estaRepetido(quitado)) {
      restantes.push(quitado);
      continue;
    }
    const mejor = mejorCandidato(
      quitado,
      // El mismo nombre en otro almacén es un movimiento, no un renombre.
      (candidato) =>
        norm(candidato['Numero pedido']) === norm(quitado['Numero pedido']) &&
        norm(candidato.Cantidad) === norm(quitado.Cantidad) &&
        norm(candidato.Producto) !== norm(quitado.Producto),
      PARECIDO_MINIMO_NOMBRE_OTRO_ALMACEN,
    );
    if (mejor) {
      agregadosLibres.delete(mejor);
      cambios.push({ actual: quitado, leido: mejor, almacenDistinto: true });
    } else {
      restantes.push(quitado);
    }
  }
  quitadosSinPareja = restantes;

  const resultado: DiferenciaConFilas[] = [];
  const siguienteId = () => resultado.length + 1;

  for (const { actual, leido, almacenDistinto } of cambios) {
    resultado.push({
      publica: {
        id: siguienteId(),
        tipo: 'cambiar',
        ...contexto(actual),
        actual: datos(actual),
        leido: datos(leido),
        ...(almacenDistinto
          ? { almacenLeido: String(leido.Almacen ?? '').trim() }
          : {}),
      },
      filaActual: actual,
      filaLeida: leido,
    });
  }
  for (const quitado of quitadosSinPareja) {
    resultado.push({
      publica: {
        id: siguienteId(),
        tipo: 'quitar',
        ...contexto(quitado),
        actual: datos(quitado),
        ...((conteoDespues.get(clave(quitado)) ?? 0) > 0
          ? { repetidoEnActual: true }
          : {}),
      },
      filaActual: quitado,
    });
  }
  for (const agregado of agregados) {
    if (!agregadosLibres.has(agregado)) continue;
    resultado.push({
      publica: {
        id: siguienteId(),
        tipo: 'agregar',
        ...contexto(agregado),
        leido: datos(agregado),
      },
      filaLeida: agregado,
    });
  }
  return resultado;
}

/**
 * Renglones resultantes: las filas actuales, más las diferencias cuyo id está en
 * `aplicadas`. Lo no aplicado queda tal como está hoy en la orden.
 */
export function aplicarDiferencias(
  antes: readonly OrigenCorreoRenglon[],
  diferencias: readonly DiferenciaConFilas[],
  aplicadas: ReadonlySet<number>,
): OrigenCorreoRenglon[] {
  const quitar = new Set<OrigenCorreoRenglon>();
  const reemplazar = new Map<OrigenCorreoRenglon, OrigenCorreoRenglon>();
  const agregar: OrigenCorreoRenglon[] = [];

  for (const { publica, filaActual, filaLeida } of diferencias) {
    if (!aplicadas.has(publica.id)) continue;
    if (publica.tipo === 'quitar' && filaActual) quitar.add(filaActual);
    if (publica.tipo === 'cambiar' && filaActual && filaLeida) {
      // Con otro almacén en el documento solo se corrige el nombre del producto.
      reemplazar.set(
        filaActual,
        publica.almacenLeido === undefined
          ? filaLeida
          : {
              ...filaActual,
              Producto: filaLeida.Producto,
              ...(filaLeida['Codigo producto'] === undefined
                ? {}
                : { 'Codigo producto': filaLeida['Codigo producto'] }),
            },
      );
    }
    if (publica.tipo === 'agregar' && filaLeida) agregar.push(filaLeida);
  }

  const base: OrigenCorreoRenglon[] = [];
  for (const fila of antes) {
    if (quitar.has(fila)) continue;
    base.push(reemplazar.get(fila) ?? fila);
  }
  return [...base, ...agregar];
}
