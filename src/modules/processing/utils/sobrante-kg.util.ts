import { unidadPrimarioNormalizada } from './desperdicio-kg-sugerido.util';

export function parteFraccionariaUnidadesSecundario(est: number): number {
  if (!Number.isFinite(est) || est <= 0) return 0;
  const whole = Math.floor(est + 1e-9);
  const frac = est - whole;
  return frac > 1e-9 ? Math.round(frac * 1e8) / 1e8 : 0;
}

export function kgPrimarioDesdeFraccionUnidadesSecundario(
  estimadoUnidades: number | null | undefined,
  reglaCantidadPrimario?: number | null,
  reglaUnidadesSecundario?: number | null,
): number {
  const est = Number(estimadoUnidades);
  const a = Number(reglaCantidadPrimario);
  const b = Number(reglaUnidadesSecundario);
  if (!Number.isFinite(est) || est <= 0 || !(a > 0) || !(b > 0)) return 0;
  const frac = parteFraccionariaUnidadesSecundario(est);
  if (frac <= 0) return 0;
  return Math.round(((frac * a) / b) * 10000) / 10000;
}

export function sobranteKgDesdeCantidadYDesconto(
  unidadPrimarioVisualizacion: string | undefined,
  cantidadPrimario: number,
  deductedKg: number,
): number {
  if (unidadPrimarioNormalizada(unidadPrimarioVisualizacion) !== 'peso') {
    return 0;
  }
  const c = Number(cantidadPrimario) || 0;
  const d = Math.max(0, Number(deductedKg) || 0);
  if (!Number.isFinite(c) || !Number.isFinite(d) || c < 0) return 0;
  const fracC = Math.max(0, c - Math.floor(c + 1e-9));
  const fracD = Math.max(0, d - Math.floor(d + 1e-9));
  const excesoVsPedidoEntero = Math.max(0, d - Math.floor(c + 1e-9));
  const v = Math.max(fracC, fracD, excesoVsPedidoEntero);
  return Math.round(Math.max(0, v) * 10000) / 10000;
}

export function sobranteKgTotalTrasEnCurso(params: {
  unidadPrimarioVisualizacion?: string;
  cantidadPrimario: number;
  deductedKg: number;
  estimadoUnidadesSecundario?: number | null;
  reglaCantidadPrimario?: number | null;
  reglaUnidadesSecundario?: number | null;
}): number {
  const s1 = sobranteKgDesdeCantidadYDesconto(
    params.unidadPrimarioVisualizacion,
    params.cantidadPrimario,
    params.deductedKg,
  );
  const s2 = kgPrimarioDesdeFraccionUnidadesSecundario(
    params.estimadoUnidadesSecundario,
    params.reglaCantidadPrimario,
    params.reglaUnidadesSecundario,
  );
  return Math.round(Math.max(0, s1 + s2) * 10000) / 10000;
}

export function kgSobranteParaDevolucionMapa(params: {
  sobranteKg?: number | null;
  unidadPrimarioVisualizacion?: string;
}): number {
  if (
    unidadPrimarioNormalizada(params.unidadPrimarioVisualizacion) !== 'peso'
  ) {
    return 0;
  }
  const s = Number(params.sobranteKg);
  if (!Number.isFinite(s) || s <= 1e-9) return 0;
  return Math.round(s * 10000) / 10000;
}
