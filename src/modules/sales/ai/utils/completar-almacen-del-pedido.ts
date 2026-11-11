/**
 * REQ-291: un pedido llega a veces con el almacén escrito solo en la primera fila y vacío
 * en las demás. Agrupar por pedido + almacén las partía en dos OT («COM cocina IRD» y «sin
 * almacén») aunque nada indicaba que fueran cocinas distintas.
 *
 * Si todas las filas con almacén de un pedido nombran el mismo almacén, las filas vacías de
 * ese pedido se unen a él. Si el pedido nombra más de un almacén no se adivina: quedan como están.
 * Esta función debe quedar igual en `polaria-wms-web` y en `polaria-wms-api`.
 */

interface FilaConAlmacen {
  Almacen?: string;
  'Numero pedido'?: string;
  _otId?: string;
}

function texto(value: string | null | undefined): string {
  return (value ?? '').toString().trim();
}

/** Sin tildes, mayúsculas ni espacios de más: «Producción» y «produccion» son el mismo almacén. */
function comparable(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function completarAlmacenDelPedido<T extends FilaConAlmacen>(
  filas: readonly T[],
): T[] {
  const almacenPorPedido = new Map<string, string | null>();
  for (const fila of filas) {
    if (texto(fila._otId)) continue;
    const almacen = texto(fila.Almacen);
    if (!almacen) continue;
    const pedido = comparable(texto(fila['Numero pedido']));
    const visto = almacenPorPedido.get(pedido);
    if (visto === undefined) almacenPorPedido.set(pedido, almacen);
    else if (visto !== null && comparable(visto) !== comparable(almacen)) {
      almacenPorPedido.set(pedido, null);
    }
  }

  return filas.map((fila) => {
    if (texto(fila._otId) || texto(fila.Almacen)) return fila;
    const pedido = comparable(texto(fila['Numero pedido']));
    const unico = pedido ? almacenPorPedido.get(pedido) : null;
    return unico ? { ...fila, Almacen: unico } : fila;
  });
}
