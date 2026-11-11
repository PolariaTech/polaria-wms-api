import type { OrigenCorreoRenglon } from './origen-correo-ordenes-trabajo';

function norm(value: string | null | undefined): string {
  return (value ?? '').toString().trim();
}

function normKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Clave semántica pedido + almacén + número almacén. */
export function baseGroupKeyOrigenCorreo(renglon: OrigenCorreoRenglon): string {
  const pedido = norm(renglon['Numero pedido']);
  const almacen = norm(renglon.Almacen);
  const numeroAlmacen = norm(renglon['Numero almacen']);
  const referencia = norm(renglon['Referencia pedido']);

  if (pedido || almacen) {
    const num =
      numeroAlmacen && numeroAlmacen !== '_'
        ? `|numAlmacen:${normKey(numeroAlmacen)}`
        : '';
    return `pedido:${pedido ? normKey(pedido) : '_'}|almacen:${almacen ? normKey(almacen) : '_'}${num}`;
  }
  if (referencia) return `ref:${normKey(referencia)}`;
  return 'default';
}

/**
 * REQ-238: misma cocina/pedido no contigua (tras otra cocina) = otra OT.
 */
export function contiguousOtIdsForRenglones(
  renglones: readonly OrigenCorreoRenglon[],
): string[] {
  const ids: string[] = [];
  let lastAutoBase: string | null = null;
  let bloqueSeq = 0;

  for (const row of renglones) {
    const base = baseGroupKeyOrigenCorreo(row);
    if (base !== lastAutoBase) {
      bloqueSeq += 1;
      lastAutoBase = base;
    }
    ids.push(base === 'default' ? 'default' : `${base}|bloque:${bloqueSeq}`);
  }

  return ids;
}
