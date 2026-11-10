/**
 * POL-414 · Qué hacer con cada diferencia entre la orden actual y lo leído, según la
 * instrucción del operador. Sin instrucción, sin diferencias o con una instrucción que no
 * limita nada, se adopta lo leído tal cual (el comportamiento de siempre). Si el paso de
 * IA falla o responde algo inválido, también, y se avisa al operador en lenguaje claro.
 */
import type { Logger } from '@nestjs/common';
import { reconciliarDiferencias } from '../ai/openai-reconciliacion.client';
import type { OrigenCorreoRenglon } from '../ai/utils/origen-correo-ordenes-trabajo';
import {
  alcanceSoloArchivo,
  normalizarOc,
} from '../ai/utils/relectura-alcance-archivo';
import {
  aplicarDiferencias,
  calcularDiferencias,
  MAX_DIFERENCIAS_RECONCILIACION,
  motivoDeDiferencia,
  type MotivoDiferencia,
} from '../ai/utils/relectura-diferencias';
import type { AdvertenciaLectura } from './pedido-ia.service';

export interface EntradaReconciliarRelectura {
  instruccion: string | undefined;
  antes: OrigenCorreoRenglon[];
  leidos: OrigenCorreoRenglon[];
  archivosIgnorados: string[];
  /** Archivos leídos y su OC: «Solo X» puede referirse a uno de ellos. */
  documentos: { nombre: string; oc: string | null }[];
  advertencias: AdvertenciaLectura[];
}

export interface ResultadoReconciliarRelectura {
  renglones: OrigenCorreoRenglon[];
  motivos: MotivoDiferencia[];
  tokensTotal: number;
  costoUSD: number | null;
}

const AVISO_SIN_RECONCILIAR =
  'No se pudo aplicar tu instrucción diferencia por diferencia, así que se muestra todo lo que dicen los documentos. Revísalo antes de aplicar.';

export async function reconciliarRelectura(
  input: EntradaReconciliarRelectura,
  logger: Logger,
): Promise<ResultadoReconciliarRelectura> {
  const sinCambios: ResultadoReconciliarRelectura = {
    renglones: input.leidos,
    motivos: [],
    tokensTotal: 0,
    costoUSD: 0,
  };
  const instruccion = input.instruccion?.trim();
  if (!instruccion) return sinCambios;

  const diferencias = calcularDiferencias(input.antes, input.leidos);
  if (diferencias.length === 0) return sinCambios;

  // «Solo X» con X = un archivo se resuelve aquí, sin IA y de forma repetible.
  const soloArchivo = alcanceSoloArchivo(instruccion, input.documentos);
  if (soloArchivo) {
    const dentro = new Set(
      diferencias
        .filter(({ publica }) => soloArchivo.ocs.has(normalizarOc(publica.numeroPedido)))
        .map(({ publica }) => publica.id),
    );
    input.advertencias.push({
      codigo: 'ALCANCE_INTERPRETADO',
      detalle: soloArchivo.descripcion,
    });
    const motivosArchivo: MotivoDiferencia[] = [];
    for (const { publica } of diferencias) {
      const aplicada = dentro.has(publica.id);
      if (!aplicada) {
        motivosArchivo.push(
          motivoDeDiferencia(publica, false, 'Es de otro archivo: no lo pediste.'),
        );
      } else if (publica.tipo === 'quitar') {
        motivosArchivo.push(
          motivoDeDiferencia(publica, true, 'Los documentos de ese archivo no lo traen.'),
        );
      }
    }
    return {
      renglones: aplicarDiferencias(input.antes, diferencias, dentro),
      motivos: motivosArchivo,
      tokensTotal: 0,
      costoUSD: 0,
    };
  }

  const avisarSinReconciliar = () =>
    input.advertencias.push({
      codigo: 'RECONCILIACION_NO_DISPONIBLE',
      detalle: AVISO_SIN_RECONCILIAR,
    });
  if (diferencias.length > MAX_DIFERENCIAS_RECONCILIACION) {
    avisarSinReconciliar();
    return sinCambios;
  }

  let resultado: Awaited<ReturnType<typeof reconciliarDiferencias>>;
  try {
    resultado = await reconciliarDiferencias({
      instruccion,
      diferencias: diferencias.map((diferencia) => diferencia.publica),
      archivosIgnorados: input.archivosIgnorados,
      documentos: input.documentos,
    });
  } catch (error) {
    logger.warn(
      `reconciliacion_fallida ${error instanceof Error ? error.message : 'desconocido'}`,
    );
    avisarSinReconciliar();
    return sinCambios;
  }

  const uso = {
    tokensTotal: resultado.uso?.tokensTotal ?? 0,
    costoUSD: resultado.uso ? resultado.uso.costoUSD : 0,
  };
  if (!resultado.acotada) return { ...sinCambios, ...uso };

  // El operador debe ver qué se tomó como límite (archivo, almacén u OT).
  if (resultado.alcance) {
    input.advertencias.push({
      codigo: 'ALCANCE_INTERPRETADO',
      detalle: resultado.alcance,
    });
  }

  const decisionPorId = new Map(
    resultado.decisiones.map((decision) => [decision.id, decision]),
  );
  const aplicadas = new Set(
    resultado.decisiones
      .filter((decision) => decision.decision === 'aplicar')
      .map((decision) => decision.id),
  );
  const motivos: MotivoDiferencia[] = [];
  for (const { publica } of diferencias) {
    const aplicada = aplicadas.has(publica.id);
    // Lo no aplicado y lo que se quita se explican; lo demás se ve en la propuesta.
    if (!aplicada || publica.tipo === 'quitar') {
      motivos.push(
        motivoDeDiferencia(
          publica,
          aplicada,
          decisionPorId.get(publica.id)?.motivo ?? '',
        ),
      );
    }
  }
  return {
    renglones: aplicarDiferencias(input.antes, diferencias, aplicadas),
    motivos,
    ...uso,
  };
}
