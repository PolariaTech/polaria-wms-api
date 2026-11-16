/**
 * REQ-313 · Releer el correo en una OV que salió de un correo partido.
 *
 * Un correo con varias OC se parte en varias OV que guardan los MISMOS archivos originales
 * (`origen_archivos`). Releer baja todos los archivos, así que la lectura trae también las OC
 * de las OV hermanas. Aquí se decide, sin Nest ni base de datos, qué OC son ajenas y se
 * quitan esas filas de lo leído. Sin hermanas no se filtra nada (una OV puede ampliarse a
 * varias OC al releer).
 */
import {
  parseOrigenCorreoJson,
  type OrigenCorreoRenglon,
} from './origen-correo-ordenes-trabajo';
import { normalizarOc } from './relectura-alcance-archivo';

export interface HermanaRelectura {
  codigo: string;
  ordenCompra: string | null;
  origenCorreo: unknown;
}

export type CodigoBloqueoHermanas = 'HERMANAS_SIN_OC' | 'HERMANAS_MISMA_OC';

export type EvaluacionHermanas =
  | { tipo: 'libre' }
  | {
      tipo: 'filtrar';
      /** OC normalizada → código de la OV hermana que la tiene. */
      ocsAjenas: Map<string, string>;
    }
  | { tipo: 'bloqueo'; codigo: CodigoBloqueoHermanas };

export const MENSAJE_HERMANAS_SIN_OC =
  'Esta OV salió de un correo que se partió en varias OV y no tiene orden de compra: no se puede releer sin mezclar los pedidos de las otras OV.';
export const MENSAJE_HERMANAS_MISMA_OC =
  'Esta OV comparte la orden de compra con otra OV del mismo correo: releer mezclaría sus productos.';

export const MENSAJES_BLOQUEO_HERMANAS: Record<CodigoBloqueoHermanas, string> =
  {
    HERMANAS_SIN_OC: MENSAJE_HERMANAS_SIN_OC,
    HERMANAS_MISMA_OC: MENSAJE_HERMANAS_MISMA_OC,
  };

/** Valores no vacíos y normalizados de «Numero pedido» de unos renglones. */
function ocsDeRenglones(renglones: readonly OrigenCorreoRenglon[]): string[] {
  return renglones
    .map((renglon) => normalizarOc(renglon['Numero pedido']))
    .filter(Boolean);
}

export function evaluarHermanas(entrada: {
  ordenCompra: string | null;
  antes: readonly OrigenCorreoRenglon[];
  hermanas: readonly HermanaRelectura[];
}): EvaluacionHermanas {
  const { ordenCompra, antes, hermanas } = entrada;
  if (hermanas.length === 0) return { tipo: 'libre' };

  // La OC de la OV manda: sus renglones pueden estar contaminados con la OC de una hermana.
  // Solo sin OC propia se toman las de los renglones actuales.
  const ocPropia = normalizarOc(ordenCompra);
  const propias = new Set(ocPropia ? [ocPropia] : ocsDeRenglones(antes));
  if (propias.size === 0) return { tipo: 'bloqueo', codigo: 'HERMANAS_SIN_OC' };

  const ocsAjenas = new Map<string, string>();
  for (const hermana of hermanas) {
    const ocs = [
      normalizarOc(hermana.ordenCompra),
      ...ocsDeRenglones(parseOrigenCorreoJson(hermana.origenCorreo)),
    ];
    for (const oc of ocs) {
      if (oc && !propias.has(oc) && !ocsAjenas.has(oc)) {
        ocsAjenas.set(oc, hermana.codigo);
      }
    }
  }
  if (ocsAjenas.size === 0)
    return { tipo: 'bloqueo', codigo: 'HERMANAS_MISMA_OC' };
  return { tipo: 'filtrar', ocsAjenas };
}

export interface LeidosFiltrados {
  renglones: OrigenCorreoRenglon[];
  /** Por OV hermana: la OC dejada fuera y cuántas filas se quitaron. */
  omitidosPorOv: Map<string, { oc: string; cantidad: number }>;
}

export function filtrarLeidosDeHermanas(
  leidos: readonly OrigenCorreoRenglon[],
  ocsAjenas: ReadonlyMap<string, string>,
): LeidosFiltrados {
  const renglones: OrigenCorreoRenglon[] = [];
  const omitidosPorOv = new Map<string, { oc: string; cantidad: number }>();
  for (const fila of leidos) {
    const oc = normalizarOc(fila['Numero pedido']);
    const ov = oc ? ocsAjenas.get(oc) : undefined;
    if (!ov) {
      renglones.push(fila);
      continue;
    }
    const previo = omitidosPorOv.get(ov);
    if (previo) previo.cantidad += 1;
    else omitidosPorOv.set(ov, { oc, cantidad: 1 });
  }
  return { renglones, omitidosPorOv };
}
