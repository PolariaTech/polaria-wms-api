import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { OrdenVentaDivisionService } from './orden-venta-division.service';

jest.mock('../../../core/database/tenant-scope.util', () => ({
  assertOperationalTenantScope: jest.fn(),
}));
import { assertOperationalTenantScope } from '../../../core/database/tenant-scope.util';

const ID_OV = '11111111-1111-4111-8111-111111111111';
const ctx = { schemaName: 'demo' } as unknown as TenantContext;

const renglon = (oc: string, producto: string, indice: number) => ({
  'Numero pedido': oc,
  Producto: producto,
  Almacen: 'COCINA',
  _lineaIndex: indice,
});

function armar(fila: Record<string, unknown> | null) {
  const consultas: Array<{ sql: string; valores: unknown[] }> = [];
  const tx = {
    $queryRawUnsafe: jest.fn((sql: string, ...valores: unknown[]) => {
      consultas.push({ sql, valores });
      if (sql.includes('FOR UPDATE')) return Promise.resolve(fila ? [fila] : []);
      return Promise.resolve([
        { idOrdenVenta: 'nueva-1', codigo: 'OV-2' },
      ]);
    }),
    $executeRawUnsafe: jest.fn((sql: string, ...valores: unknown[]) => {
      consultas.push({ sql, valores });
      return Promise.resolve(1);
    }),
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const locator = { assertSafeSchemaIdent: (s: string) => s };
  const service = new OrdenVentaDivisionService(
    prisma as never,
    locator as never,
  );
  return { service, consultas };
}

const filaBase = {
  idOrdenVenta: ID_OV,
  codigoCuenta: 'DEMO',
  idBodega: 'b1',
  estado: 'por_confirmar',
  origenCorreo: [
    renglon('4502988065', 'Aguacate', 0),
    renglon('4502988746', 'Limón', 1),
    renglon('4502988746', 'Piña', 2),
  ],
};

describe('OrdenVentaDivisionService', () => {
  beforeEach(() => {
    (assertOperationalTenantScope as jest.Mock).mockReset();
  });

  it('crea una OV con los renglones de la OC que sale y deja la otra en la actual', async () => {
    const { service, consultas } = armar(filaBase);

    const res = await service.dividir(ID_OV, { ocSalen: ['4502988746'] }, ctx);

    expect(res.ocQuedan).toEqual(['4502988065']);
    expect(res.ordenesNuevas).toEqual([
      { idOrdenVenta: 'nueva-1', codigo: 'OV-2', ordenCompra: '4502988746' },
    ]);
    const insercion = consultas.find((c) => c.sql.startsWith('INSERT'))!;
    const nuevos = JSON.parse(insercion.valores[1] as string) as unknown[];
    expect(nuevos).toHaveLength(2);
    expect(insercion.valores[2]).toBe('4502988746');
    const actualiza = consultas.find((c) => c.sql.startsWith('UPDATE'))!;
    const quedan = JSON.parse(actualiza.valores[1] as string) as Array<{
      Producto: string;
      _lineaIndex: number;
    }>;
    expect(quedan.map((r) => r.Producto)).toEqual(['Aguacate']);
    expect(actualiza.valores[2]).toBe('4502988065');
  });

  it('con tres OC, sale una y la actual conserva una de las dos que quedan', async () => {
    const { service, consultas } = armar({
      ...filaBase,
      origenCorreo: [
        renglon('OC-A', 'x', 0),
        renglon('OC-B', 'y', 1),
        renglon('OC-C', 'z', 2),
      ],
    });

    const res = await service.dividir(ID_OV, { ocSalen: ['OC-A'] }, ctx);

    expect(res.ocQuedan).toEqual(['OC-B', 'OC-C']);
    const actualiza = consultas.find((c) => c.sql.startsWith('UPDATE'))!;
    expect(actualiza.valores[2]).toBe('OC-B');
    expect(JSON.parse(actualiza.valores[1] as string)).toHaveLength(2);
  });

  it('compara las OC sin importar espacios ni mayúsculas', async () => {
    const { service } = armar({
      ...filaBase,
      origenCorreo: [renglon('oc-a', 'x', 0), renglon('OC-B', 'y', 1)],
    });

    const res = await service.dividir(ID_OV, { ocSalen: [' OC-A '] }, ctx);

    expect(res.ordenesNuevas[0]?.ordenCompra).toBe('oc-a');
  });

  it('no deja salir todas las OC', async () => {
    const { service, consultas } = armar(filaBase);

    await expect(
      service.dividir(
        ID_OV,
        { ocSalen: ['4502988065', '4502988746'] },
        ctx,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(consultas.some((c) => c.sql.startsWith('INSERT'))).toBe(false);
  });

  it('rechaza una OC que no está en la orden', async () => {
    const { service } = armar(filaBase);

    await expect(
      service.dividir(ID_OV, { ocSalen: ['9999'] }, ctx),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('solo divide órdenes por confirmar', async () => {
    const { service } = armar({ ...filaBase, estado: 'confirmada' });

    await expect(
      service.dividir(ID_OV, { ocSalen: ['4502988746'] }, ctx),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('una OV inexistente o de otra cuenta responde 404', async () => {
    await expect(
      armar(null).service.dividir(ID_OV, { ocSalen: ['1'] }, ctx),
    ).rejects.toBeInstanceOf(NotFoundException);

    (assertOperationalTenantScope as jest.Mock).mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(
      armar(filaBase).service.dividir(
        ID_OV,
        { ocSalen: ['4502988746'] },
        ctx,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
