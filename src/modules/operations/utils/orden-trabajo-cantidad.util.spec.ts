import { Prisma } from '../../../generated/prisma/client';
import { resolveCantidadAMover } from './orden-trabajo-cantidad.util';

describe('resolveCantidadAMover', () => {
  it('retorna null si no hay líneas (transferir todo el slot)', () => {
    expect(resolveCantidadAMover([])).toBeNull();
  });

  it('suma cantidades de líneas de la OT', () => {
    const cantidad = resolveCantidadAMover([
      { cantidad: new Prisma.Decimal(10) },
      { cantidad: new Prisma.Decimal(5) },
    ]);

    expect(cantidad?.toNumber()).toBe(15);
  });

  it('usa cantidad parcial para despacho a_salida (ej. 10 de 60 kg)', () => {
    const cantidad = resolveCantidadAMover([
      { cantidad: new Prisma.Decimal(10) },
    ]);

    expect(cantidad?.toNumber()).toBe(10);
  });
});
