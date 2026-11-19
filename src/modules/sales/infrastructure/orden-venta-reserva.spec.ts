import { Prisma } from '../../../generated/prisma/client';
import { reservarStock, type OrdenAReservar } from './orden-venta-reserva';

const SCHEMA = 'emp_demo';

function filaStock(idProducto: string, idWarehouseState: string, cantidad = 5) {
  return {
    idWarehouseState,
    idUbicacion: `ubicacion-${idWarehouseState}`,
    idLote: null,
    idProducto,
    cantidad: new Prisma.Decimal(cantidad),
    cantidadReservada: new Prisma.Decimal(0),
    fechaVencimiento: null,
  };
}

function ordenConLineas(idsProducto: string[]): OrdenAReservar {
  return {
    idOrdenVenta: 'ov-1',
    codigoCuenta: 'CTA1',
    idBodega: 'bodega-1',
    lineas: idsProducto.map((idProducto) => ({
      idProducto,
      cantidadPedida: new Prisma.Decimal(3),
    })),
  };
}

/** Cliente de transacción falso que responde la lectura de stock con `filas`. */
function crearTransaccion(filas: unknown[]) {
  const sentencias: string[] = [];
  const parametros: unknown[][] = [];
  const consultar = jest.fn((sql: string, ...valores: unknown[]) => {
    sentencias.push(sql);
    parametros.push(valores);
    return Promise.resolve(filas);
  });
  const ejecutar = jest.fn((sql: string, ...valores: unknown[]) => {
    sentencias.push(sql);
    parametros.push(valores);
    return Promise.resolve(1);
  });
  return {
    transaccion: { $queryRawUnsafe: consultar, $executeRawUnsafe: ejecutar },
    sentencias,
    parametros,
  };
}

describe('reservarStock', () => {
  it('no consulta nada si la OV no tiene líneas', async () => {
    const { transaccion, sentencias } = crearTransaccion([]);

    const asignaciones = await reservarStock(
      transaccion as never,
      SCHEMA,
      ordenConLineas([]),
      'usuario-1',
    );

    expect(asignaciones).toEqual([]);
    expect(sentencias).toHaveLength(0);
  });

  it('solo lee el stock si no hay nada que reservar', async () => {
    const { transaccion, sentencias, parametros } = crearTransaccion([]);

    const asignaciones = await reservarStock(
      transaccion as never,
      SCHEMA,
      ordenConLineas(['producto-1']),
      'usuario-1',
    );

    expect(asignaciones).toEqual([]);
    expect(sentencias).toHaveLength(1);
    expect(parametros[0]).toEqual(['CTA1', 'bodega-1', '["producto-1"]']);
  });

  it('lee los productos una vez aunque se repitan en varias líneas', async () => {
    const { transaccion, parametros } = crearTransaccion([]);

    await reservarStock(
      transaccion as never,
      SCHEMA,
      ordenConLineas(['producto-1', 'producto-1', 'producto-2']),
      'usuario-1',
    );

    expect(parametros[0]?.[2]).toBe('["producto-1","producto-2"]');
  });

  it('reserva 200 líneas con tres sentencias y suma lo reservado por fila', async () => {
    const productos = Array.from(
      { length: 200 },
      (_valor, indice) => `producto-${indice}`,
    );
    const filas = productos.map((producto, indice) =>
      filaStock(producto, `stock-${indice}`),
    );
    const { transaccion, sentencias, parametros } = crearTransaccion(filas);

    const asignaciones = await reservarStock(
      transaccion as never,
      SCHEMA,
      ordenConLineas(productos),
      'usuario-1',
    );

    // lectura de stock, UPDATE de reservas y movimientos
    expect(sentencias).toHaveLength(3);
    expect(asignaciones).toHaveLength(200);

    const reservas = JSON.parse(parametros[1]?.[0] as string) as Array<{
      id_warehouse_state: string;
      cantidad: string;
    }>;
    expect(reservas).toHaveLength(200);
    expect(reservas[0]).toEqual({
      id_warehouse_state: 'stock-0',
      cantidad: '3',
    });

    const movimientos = JSON.parse(parametros[2]?.[5] as string) as unknown[];
    expect(movimientos).toHaveLength(200);
    expect(parametros[2]?.slice(0, 5)).toEqual([
      'CTA1',
      'bodega-1',
      'usuario-1',
      'ov-1',
      'orden_venta',
    ]);
  });

  it('suma en un solo UPDATE lo que dos líneas toman de la misma fila', async () => {
    const { transaccion, parametros } = crearTransaccion([
      filaStock('producto-1', 'stock-1', 10),
    ]);

    await reservarStock(
      transaccion as never,
      SCHEMA,
      ordenConLineas(['producto-1', 'producto-1']),
      'usuario-1',
    );

    const reservas = JSON.parse(parametros[1]?.[0] as string) as Array<{
      id_warehouse_state: string;
      cantidad: string;
    }>;
    expect(reservas).toEqual([
      { id_warehouse_state: 'stock-1', cantidad: '6' },
    ]);
    const movimientos = JSON.parse(parametros[2]?.[5] as string) as unknown[];
    expect(movimientos).toHaveLength(2);
  });
});
