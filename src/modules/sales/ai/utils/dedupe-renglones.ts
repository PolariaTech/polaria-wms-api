import type { PedidoExtraido } from '../openai-pedido.client';
import type { OrigenCorreoRenglon } from './origen-correo-ordenes-trabajo';

function normalizar(valor: string | number | undefined): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Huella de un renglón: mismo producto, cantidad, unidad, almacén y pedido. */
function huella(renglon: OrigenCorreoRenglon): string {
  return [
    renglon['Codigo producto'],
    renglon.Producto,
    renglon.Cantidad,
    renglon.Unidad,
    renglon.Almacen,
    renglon['Numero pedido'],
  ]
    .map(normalizar)
    .join('|');
}

/**
 * REQ-288 / REQ-299: el cuerpo del correo y el PDF (o el .eml y su adjunto) listan el mismo
 * pedido y cada uno se lee por separado; al unirlos los productos salían dos veces. Quita de
 * cada documento los renglones que ya trae uno anterior. Los repetidos dentro de un mismo
 * documento no se tocan (pueden ser legítimos, p. ej. el mismo producto con otro destino).
 */
export function quitarRenglonesRepetidosEntreDocumentos(
  pedidos: readonly PedidoExtraido[],
): { pedidos: PedidoExtraido[]; descartados: number } {
  if (pedidos.length <= 1) return { pedidos: pedidos.slice(), descartados: 0 };

  const vistos = new Set<string>();
  let descartados = 0;
  const resultado = pedidos.map((documento) => {
    const huellas = documento.origenCorreo.map(huella);
    const conservar = huellas.map((clave) => !vistos.has(clave));
    huellas.forEach((clave) => vistos.add(clave));
    const quitados = conservar.filter((conserva) => !conserva).length;
    if (quitados === 0) return documento;

    descartados += quitados;
    const alineadas = documento.lineas.length === documento.origenCorreo.length;
    return {
      ...documento,
      lineas: alineadas
        ? documento.lineas.filter((_, indice) => conservar[indice])
        : documento.lineas,
      origenCorreo: documento.origenCorreo
        .filter((_, indice) => conservar[indice])
        .map((renglon, indice) => ({ ...renglon, _lineaIndex: indice })),
    };
  });
  return { pedidos: resultado, descartados };
}
