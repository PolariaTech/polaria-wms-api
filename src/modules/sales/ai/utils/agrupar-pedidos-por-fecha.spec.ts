import type { PedidoExtraido } from '../openai-pedido.client';
import { agruparPedidosPorFechaEntrega } from './agrupar-pedidos-por-fecha';

function pedido(parcial: Partial<PedidoExtraido>): PedidoExtraido {
  return {
    fechaEntrega: null,
    centroConsumo: null,
    observaciones: null,
    ordenCompraHotel: null,
    nombreCliente: 'Hotel',
    lineas: [],
    origenCorreo: [],
    advertencia: null,
    archivosNoLegibles: [],
    ...parcial,
  } as PedidoExtraido;
}

describe('agruparPedidosPorFechaEntrega (REQ-197)', () => {
  it('separa dos OC distintas del mismo día en dos pedidos (REQ-245)', () => {
    const sabadoA = pedido({
      fechaEntrega: '2026-11-07',
      ordenCompraHotel: 'OC-1',
      origenCorreo: [{ Producto: 'a' }],
    });
    const sabadoB = pedido({
      fechaEntrega: '2026-11-07',
      ordenCompraHotel: 'OC-2',
      origenCorreo: [{ Producto: 'b' }],
    });

    const grupos = agruparPedidosPorFechaEntrega([sabadoA, sabadoB]);

    expect(grupos.map((grupo) => grupo.ordenCompraHotel)).toEqual([
      'OC-1',
      'OC-2',
    ]);
  });

  it('une la misma OC del mismo día en un solo pedido', () => {
    const a = pedido({
      fechaEntrega: '2026-11-07',
      ordenCompraHotel: 'OC-1',
      origenCorreo: [{ Producto: 'a' }],
    });
    const b = pedido({
      fechaEntrega: '2026-11-07',
      ordenCompraHotel: ' oc-1 ',
      origenCorreo: [{ Producto: 'b' }],
    });

    const grupos = agruparPedidosPorFechaEntrega([a, b]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.origenCorreo).toHaveLength(2);
  });

  it('separa la misma OC entregada en dos días', () => {
    const a = pedido({
      fechaEntrega: '2026-11-07',
      ordenCompraHotel: 'OC-1',
      origenCorreo: [{ Producto: 'a' }],
    });
    const b = pedido({
      fechaEntrega: '2026-11-08',
      ordenCompraHotel: 'OC-1',
      origenCorreo: [{ Producto: 'b' }],
    });

    expect(agruparPedidosPorFechaEntrega([a, b])).toHaveLength(2);
  });

  it('sin fecha, parte solo por OC', () => {
    const a = pedido({ ordenCompraHotel: 'OC-1' });
    const b = pedido({ ordenCompraHotel: 'OC-2' });

    expect(agruparPedidosPorFechaEntrega([a, b])).toHaveLength(2);
  });

  it('separa sábado y domingo en dos pedidos', () => {
    const sabado = pedido({
      fechaEntrega: '2026-11-07',
      ordenCompraHotel: 'OC-SAB',
      origenCorreo: [{ Producto: 'a' }],
    });
    const domingo = pedido({
      fechaEntrega: '2026-11-08',
      ordenCompraHotel: 'OC-DOM',
      origenCorreo: [{ Producto: 'b' }],
    });

    const grupos = agruparPedidosPorFechaEntrega([sabado, domingo]);

    expect(grupos.map((grupo) => grupo.fechaEntrega)).toEqual([
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(grupos.map((grupo) => grupo.ordenCompraHotel)).toEqual([
      'OC-SAB',
      'OC-DOM',
    ]);
  });

  it('no parte un pedido que no trae fecha ni OC', () => {
    const uno = pedido({ origenCorreo: [{ Producto: 'a' }] });
    const dos = pedido({ origenCorreo: [{ Producto: 'b' }] });

    expect(agruparPedidosPorFechaEntrega([uno, dos])).toHaveLength(1);
  });
});
