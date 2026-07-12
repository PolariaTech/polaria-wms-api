import { Prisma } from '../../../generated/prisma/client';
import { EstadoOrdenVenta } from '../../../generated/prisma/client';
import { computeEstadoDespacho } from './orden-venta-estado.util';

describe('computeEstadoDespacho', () => {
  it('retorna despachada cuando todas las líneas están completas', () => {
    const estado = computeEstadoDespacho([
      {
        cantidadPedida: new Prisma.Decimal(10),
        cantidadDespachada: new Prisma.Decimal(10),
      },
      {
        cantidadPedida: new Prisma.Decimal(5),
        cantidadDespachada: new Prisma.Decimal(5),
      },
    ]);

    expect(estado).toBe(EstadoOrdenVenta.despachada);
  });

  it('retorna parcialmente_despachada con despacho incompleto', () => {
    const estado = computeEstadoDespacho([
      {
        cantidadPedida: new Prisma.Decimal(10),
        cantidadDespachada: new Prisma.Decimal(10),
      },
      {
        cantidadPedida: new Prisma.Decimal(5),
        cantidadDespachada: new Prisma.Decimal(2),
      },
    ]);

    expect(estado).toBe(EstadoOrdenVenta.parcialmente_despachada);
  });

  it('retorna parcialmente_despachada con una sola línea parcial', () => {
    const estado = computeEstadoDespacho([
      {
        cantidadPedida: new Prisma.Decimal(60),
        cantidadDespachada: new Prisma.Decimal(10),
      },
    ]);

    expect(estado).toBe(EstadoOrdenVenta.parcialmente_despachada);
  });
});
