import type { PedidoExtraido } from '../openai-pedido.client';
import { quitarRenglonesRepetidosEntreDocumentos } from './dedupe-renglones';

/**
 * Une lecturas de varios documentos (o de varios bloques de un documento): los campos de
 * cabecera salen del primero que los trae; renglones y líneas se concatenan.
 */
export function fusionarPedidos(
  pedidos: readonly PedidoExtraido[],
): PedidoExtraido {
  if (pedidos.length === 1) return pedidos[0];

  const base = { ...pedidos[0] } as unknown as Record<string, unknown>;
  for (const clave of Object.keys(base)) {
    if (Array.isArray(base[clave])) continue;
    const valor = pedidos
      .map(
        (pedidoParcial) =>
          (pedidoParcial as unknown as Record<string, unknown>)[clave],
      )
      .find((valor) => valor !== null && valor !== undefined && valor !== '');
    base[clave] = valor ?? base[clave];
  }

  const unido = base as unknown as PedidoExtraido;
  unido.lineas = pedidos.flatMap((pedidoParcial) => pedidoParcial.lineas);
  unido.origenCorreo = pedidos
    .flatMap((pedidoParcial) => pedidoParcial.origenCorreo)
    .map((renglon, indice) => ({ ...renglon, _lineaIndex: indice }));
  unido.archivosNoLegibles = [
    ...new Set(
      pedidos.flatMap((pedidoParcial) => pedidoParcial.archivosNoLegibles),
    ),
  ];
  const advertencias = [
    ...new Set(
      pedidos
        .map((pedidoParcial) => pedidoParcial.advertencia)
        .filter((advertencia): advertencia is string => !!advertencia),
    ),
  ];
  unido.advertencia = advertencias.length > 0 ? advertencias.join(' | ') : null;
  return unido;
}

function fechaClave(pedido: PedidoExtraido): string {
  const cruda = (pedido.fechaEntrega ?? '').trim();
  return /^(\d{4}-\d{2}-\d{2})/.exec(cruda)?.[1] ?? '';
}

function ocClave(pedido: PedidoExtraido): string {
  return (pedido.ordenCompraHotel ?? '').trim().toUpperCase();
}

/**
 * REQ-197 / REQ-245 / REQ-262: un correo genera una orden de venta por cada
 * día de entrega y por cada orden de compra. Misma OC y mismo día es una sola
 * orden (con una tarea por cocina). Si ningún documento trae fecha se parte solo
 * por OC; si ninguno trae OC, solo por día; sin ninguna de las dos, una sola.
 */
export function agruparPedidosPorFechaEntrega(
  pedidos: readonly PedidoExtraido[],
): PedidoExtraido[] {
  if (pedidos.length <= 1) return pedidos.slice();

  const hayFecha = pedidos.some((pedido) => fechaClave(pedido) !== '');
  const hayOc = pedidos.some((pedido) => ocClave(pedido) !== '');

  const grupos = new Map<string, PedidoExtraido[]>();
  for (const pedido of pedidos) {
    const clave = `${hayFecha ? fechaClave(pedido) : ''}|${hayOc ? ocClave(pedido) : ''}`;
    const lista = grupos.get(clave) ?? [];
    lista.push(pedido);
    grupos.set(clave, lista);
  }
  return [...grupos.values()].map((grupo) =>
    fusionarPedidos(quitarRenglonesRepetidosEntreDocumentos(grupo).pedidos),
  );
}
