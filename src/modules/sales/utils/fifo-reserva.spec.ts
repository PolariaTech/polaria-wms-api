import { Prisma } from '../../../generated/prisma/client';
import { asignarFifo, type FilaStockFifo } from './fifo-reserva';

const decimal = (valor: number) => new Prisma.Decimal(valor);

function fila(
  idWarehouseState: string,
  cantidad: number,
  extra: Partial<FilaStockFifo> = {},
): FilaStockFifo {
  return {
    idWarehouseState,
    idUbicacion: `ubicacion-${idWarehouseState}`,
    idLote: null,
    idProducto: 'producto-1',
    cantidad: decimal(cantidad),
    cantidadReservada: decimal(0),
    fechaVencimiento: null,
    ...extra,
  };
}

const linea = (cantidad: number, idProducto = 'producto-1') => ({
  idProducto,
  cantidad: decimal(cantidad),
});

/** Pares [fila de stock, cantidad asignada], en el orden en que se asignan. */
const asignado = (filas: FilaStockFifo[], lineas: ReturnType<typeof linea>[]) =>
  asignarFifo(filas, lineas).map((asignacion) => [
    asignacion.idWarehouseState,
    asignacion.cantidad,
  ]);

describe('asignarFifo', () => {
  it('toma primero la fila que vence antes y completa con la siguiente', () => {
    const filas = [
      fila('A', 4, { fechaVencimiento: new Date('2026-12-01') }),
      fila('B', 10, { fechaVencimiento: new Date('2027-01-01') }),
    ];

    expect(asignado(filas, [linea(6)])).toEqual([
      ['A', 4],
      ['B', 2],
    ]);
  });

  it('deja al final las filas sin fecha de vencimiento', () => {
    const filas = [
      fila('SIN-FECHA', 10),
      fila('CON-FECHA', 10, { fechaVencimiento: new Date('2027-01-01') }),
    ];

    expect(asignado(filas, [linea(3)])).toEqual([['CON-FECHA', 3]]);
  });

  it('no vuelve a ofrecer lo que ya asignó a una línea anterior', () => {
    const filas = [fila('A', 10)];

    expect(asignado(filas, [linea(6), linea(6)])).toEqual([
      ['A', 6],
      ['A', 4],
    ]);
  });

  it('pasa una fila ya usada al final de su grupo, como el updated_at = now()', () => {
    const filas = [fila('A', 10), fila('B', 10)];

    expect(asignado(filas, [linea(5), linea(5), linea(5)])).toEqual([
      ['A', 5],
      ['B', 5],
      ['A', 5],
    ]);
  });

  it('una fila usada no salta a otro vencimiento más tardío', () => {
    const filas = [
      fila('A', 10, { fechaVencimiento: new Date('2026-12-01') }),
      fila('B', 10, { fechaVencimiento: new Date('2027-01-01') }),
    ];

    expect(asignado(filas, [linea(5), linea(5)])).toEqual([
      ['A', 5],
      ['A', 5],
    ]);
  });

  it('descuenta lo que la base ya tenía reservado', () => {
    const filas = [
      fila('A', 10, { cantidadReservada: decimal(8) }),
      fila('B', 10),
    ];

    expect(asignado(filas, [linea(5)])).toEqual([
      ['A', 2],
      ['B', 3],
    ]);
  });

  it('reserva parcial si falta stock y nada si no hay filas del producto', () => {
    const filas = [fila('A', 3)];

    expect(asignado(filas, [linea(5)])).toEqual([['A', 3]]);
    expect(asignado(filas, [linea(5, 'otro-producto')])).toEqual([]);
    expect(asignado([], [linea(5)])).toEqual([]);
  });

  it('ignora filas sin disponible y líneas de cantidad cero', () => {
    const filas = [
      fila('AGOTADA', 5, { cantidadReservada: decimal(5) }),
      fila('B', 5),
    ];

    expect(asignado(filas, [linea(2), linea(0)])).toEqual([['B', 2]]);
  });

  it('mantiene el orden de las líneas y separa los productos', () => {
    const filas = [fila('A', 10), fila('Z', 10, { idProducto: 'producto-2' })];

    const resultado = asignarFifo(filas, [linea(1, 'producto-2'), linea(2)]);

    expect(
      resultado.map((asignacion) => [
        asignacion.idProducto,
        asignacion.idWarehouseState,
      ]),
    ).toEqual([
      ['producto-2', 'Z'],
      ['producto-1', 'A'],
    ]);
  });
});
