/** Regla de tres: unidades secundario esperadas (frio `unidadesSecundarioPorRegla`). */
export function unidadesSecundarioPorRegla(
  cantidadTransformarPrimario: number,
  reglaCantidadPrimario?: number | null,
  reglaUnidadesSecundario?: number | null,
): number | null {
  const a = Number(reglaCantidadPrimario);
  const b = Number(reglaUnidadesSecundario);
  const q = Number(cantidadTransformarPrimario);
  if (
    !Number.isFinite(q) ||
    q <= 0 ||
    !Number.isFinite(a) ||
    a <= 0 ||
    !Number.isFinite(b) ||
    b <= 0
  ) {
    return null;
  }
  const raw = (q / a) * b;
  return Number.isFinite(raw) ? raw : null;
}

/** Aplica % pérdida del catálogo al estimado teórico (frio `estimadoSecundarioAplicarPerdidaPct`). */
export function estimadoSecundarioAplicarPerdidaPct(
  teorico: number | null,
  perdidaPct: number | null | undefined,
): number | null {
  if (teorico === null || !Number.isFinite(teorico) || teorico < 0) {
    return null;
  }
  const pRaw = Number(perdidaPct);
  if (!Number.isFinite(pRaw) || pRaw <= 0) {
    return teorico;
  }
  const p = Math.min(100, Math.max(0, pRaw));
  const r = teorico * (1 - p / 100);
  return Number.isFinite(r) ? r : null;
}

export function unidadesSecundarioEnterasParaMapa(
  est: number | null | undefined,
): number {
  const v = Number(est);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.max(0, Math.floor(v + 1e-9));
}

export function normalizePerdidaPct(value: number | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, Math.max(0, n));
}
