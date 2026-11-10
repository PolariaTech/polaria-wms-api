import type { PedidoExtraido } from '../openai-pedido.client';
import type { OrigenCorreoRenglon } from './origen-correo-ordenes-trabajo';
import { quitarRenglonesRepetidosEntreDocumentos } from './dedupe-renglones';

function pedido(origenCorreo: OrigenCorreoRenglon[]): PedidoExtraido {
  return {
    fechaEntrega: null,
    centroConsumo: null,
    observaciones: null,
    ordenCompraHotel: null,
    nombreCliente: 'Hotel',
    lineas: origenCorreo.map((renglon) => ({
      textoOriginal: renglon.Producto,
    })),
    origenCorreo: origenCorreo.map((renglon, indice) => ({
      ...renglon,
      _lineaIndex: indice,
    })),
    advertencia: null,
    archivosNoLegibles: [],
  } as unknown as PedidoExtraido;
}

const cebolla: OrigenCorreoRenglon = {
  Producto: 'Cebolla morada',
  Cantidad: 20,
  Unidad: 'KG',
  Almacen: 'Cocina',
};

describe('quitarRenglonesRepetidosEntreDocumentos (REQ-288)', () => {
  it('quita de un documento los renglones que ya trae otro (cuerpo y PDF listan lo mismo)', () => {
    const cuerpo = pedido([cebolla, { ...cebolla, Producto: 'Pimiento rojo' }]);
    const pdf = pedido([{ ...cebolla, Producto: ' CEBOLLA  morada ' }]);

    const { pedidos, descartados } = quitarRenglonesRepetidosEntreDocumentos([
      cuerpo,
      pdf,
    ]);

    expect(descartados).toBe(1);
    expect(pedidos[0]?.origenCorreo).toHaveLength(2);
    expect(pedidos[1]?.origenCorreo).toHaveLength(0);
    expect(pedidos[1]?.lineas).toHaveLength(0);
  });

  it('ignora tildes y mayúsculas al comparar', () => {
    const a = pedido([{ ...cebolla, Producto: 'Jalapeño' }]);
    const b = pedido([{ ...cebolla, Producto: 'JALAPENO' }]);

    expect(quitarRenglonesRepetidosEntreDocumentos([a, b]).descartados).toBe(1);
  });

  it('no toca los repetidos dentro de un mismo documento', () => {
    const unico = pedido([cebolla, cebolla]);

    const { pedidos, descartados } = quitarRenglonesRepetidosEntreDocumentos([
      unico,
      pedido([{ ...cebolla, Producto: 'Tomate' }]),
    ]);

    expect(descartados).toBe(0);
    expect(pedidos[0]?.origenCorreo).toHaveLength(2);
  });

  it('conserva el renglón si cambia cantidad, unidad o almacén', () => {
    const a = pedido([cebolla]);
    const b = pedido([
      { ...cebolla, Cantidad: 10 },
      { ...cebolla, Unidad: 'PZ' },
      { ...cebolla, Almacen: 'Banquetes' },
    ]);

    const { pedidos, descartados } = quitarRenglonesRepetidosEntreDocumentos([
      a,
      b,
    ]);

    expect(descartados).toBe(0);
    expect(pedidos[1]?.origenCorreo).toHaveLength(3);
  });

  it('reindexa _lineaIndex del documento que perdió renglones', () => {
    const a = pedido([cebolla]);
    const b = pedido([cebolla, { ...cebolla, Producto: 'Tomate' }]);

    const { pedidos } = quitarRenglonesRepetidosEntreDocumentos([a, b]);

    expect(pedidos[1]?.origenCorreo).toEqual([
      expect.objectContaining({ Producto: 'Tomate', _lineaIndex: 0 }),
    ]);
    expect(pedidos[1]?.lineas).toHaveLength(1);
  });

  it('con un solo documento devuelve lo mismo', () => {
    const solo = pedido([cebolla, cebolla]);

    const { pedidos, descartados } = quitarRenglonesRepetidosEntreDocumentos([
      solo,
    ]);

    expect(descartados).toBe(0);
    expect(pedidos[0]).toBe(solo);
  });
});
