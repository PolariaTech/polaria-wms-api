import { Prisma } from '../../../generated/prisma/client';

const EPS = 1e-6;

export function cantidadesCoinciden(
  esperada: Prisma.Decimal | number,
  entregada: Prisma.Decimal | number,
): boolean {
  const a = Number(esperada);
  const b = Number(entregada);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) < EPS;
}

/** Como frio: Cerrado(ok) solo si cantidades coinciden y conformidad = true. */
export function resolverResultadoEntrega(
  lineas: Array<{ cantidadEsperada: Prisma.Decimal | number; cantidadEntregada: number }>,
  entregaConforme: boolean,
): 'ok' | 'no_ok' {
  if (lineas.length === 0) return 'no_ok';
  const todasOk = lineas.every((linea) =>
    cantidadesCoinciden(linea.cantidadEsperada, linea.cantidadEntregada),
  );
  return todasOk && entregaConforme ? 'ok' : 'no_ok';
}
