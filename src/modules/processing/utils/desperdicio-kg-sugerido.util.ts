export function unidadPrimarioNormalizada(
  vis: string | undefined | null,
): 'cantidad' | 'peso' | undefined {
  if (vis === 'cantidad' || vis === 'peso') return vis;
  const s = String(vis ?? '')
    .trim()
    .toLowerCase();
  if (s === 'cantidad' || s === 'peso') return s;
  return undefined;
}

export function desperdicioKgSugeridoDesdeMerma(params: {
  cantidadPrimario: number;
  unidadPrimarioVisualizacion?: string;
  perdidaProcesamientoPct?: number | null;
}): number | null {
  const pct = params.perdidaProcesamientoPct;
  if (pct === undefined || pct === null || !Number.isFinite(Number(pct))) {
    return null;
  }
  const p = Math.min(100, Math.max(0, Number(pct)));
  if (p <= 0) return null;
  const qty = Number(params.cantidadPrimario) || 0;
  if (qty <= 0) return null;
  if (
    unidadPrimarioNormalizada(params.unidadPrimarioVisualizacion) !== 'peso'
  ) {
    return null;
  }
  const kg = (qty * p) / 100;
  if (!Number.isFinite(kg)) return null;
  return Math.round(kg * 10000) / 10000;
}
