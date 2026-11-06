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

const renglon = (
  oc: string,
  producto: string,
  extra: Record<string, unknown> = {},
) => ({
  'Numero pedido': oc,
  Producto: producto,
  Almacen: 'COCINA',
  Fecha: '2026-11-07',
  ...extra,
});

function armar(fila: Record<string, unknown> | null) {
  const consultas: Array<{ sql: string; valores: unknown[] }> = [];
  const tx = {
    $queryRawUnsafe: jest.fn((sql: string, ...valores: unknown[]) => {
      consultas.push({ sql, valores });
      if (sql.includes('FOR UPDATE')) return Promise.resolve(fila ? [fila] : []);
      return Promise.resolve([{ idOrdenVenta: 'nueva-1', codigo: 'OV-2' }]);
    }),
    $executeRawUnsafe: jest.fn((sql: string, ...valores: unknown[]) => {
      consultas.push({ sql, valores });
      return Promise.resolve(1);
    }),
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const service = new OrdenVentaDivisionService(
    prisma as never,
    { assertSafeSchemaIdent: (s: string) => s } as never,
  );
  return { service, consultas };
}

const fila = (origenCorreo: unknown[], estado = 'por_confirmar') => ({
  idOrdenVenta: ID_OV,
  codigoCuenta: 'DEMO',
  idBodega: 'b1',
  estado,
  origenCorreo,
});

const insercion = (c: Array<{ sql: string; valores: unknown[] }>) =>
  c.filter((x) => x.sql.startsWith('INSERT'));
const actualizacion = (c: Array<{ sql: string; valores: unknown[] }>) =>
  c.find((x) => x.sql.startsWith('UPDATE'))!;

describe('OrdenVentaDivisionService', () => {
  beforeEach(() => {
    (assertOperationalTenantScope as jest.Mock).mockReset();
  });

  describe('por orden de compra', () => {
    const origen = [
      renglon('4502988065', 'Aguacate'),
      renglon('4502988746', 'Limón'),
      renglon('4502988746', 'Piña'),
    ];

    it('crea una OV con la OC que sale y deja la otra en la actual', async () => {
      const { service, consultas } = armar(fila(origen));

      const res = await service.dividir(
        ID_OV,
        { criterio: 'oc', valoresSalen: ['4502988746'] },
        ctx,
      );

      expect(res.valoresQuedan).toEqual(['4502988065']);
      expect(res.ordenesNuevas).toEqual([
        { idOrdenVenta: 'nueva-1', codigo: 'OV-2', valor: '4502988746' },
      ]);
      const [nueva] = insercion(consultas);
      expect(JSON.parse(nueva.valores[1] as string)).toHaveLength(2);
      expect(nueva.valores[2]).toBe('4502988746');
      expect(nueva.valores.slice(3)).toEqual([null, null, null]);
      const actual = actualizacion(consultas);
      expect(
        (JSON.parse(actual.valores[1] as string) as Array<{ Producto: string }>).map(
          (r) => r.Producto,
        ),
      ).toEqual(['Aguacate']);
      expect(actual.valores[2]).toBe('4502988065');
    });

    it('con tres OC, sale una y la actual conserva una de las dos que quedan', async () => {
      const { service, consultas } = armar(
        fila([renglon('OC-A', 'x'), renglon('OC-B', 'y'), renglon('OC-C', 'z')]),
      );

      const res = await service.dividir(
        ID_OV,
        { criterio: 'oc', valoresSalen: ['OC-A'] },
        ctx,
      );

      expect(res.valoresQuedan).toEqual(['OC-B', 'OC-C']);
      expect(actualizacion(consultas).valores[2]).toBe('OC-B');
    });

    it('compara las OC sin importar espacios ni mayúsculas', async () => {
      const { service } = armar(fila([renglon('oc-a', 'x'), renglon('OC-B', 'y')]));

      const res = await service.dividir(
        ID_OV,
        { criterio: 'oc', valoresSalen: [' OC-A '] },
        ctx,
      );

      expect(res.ordenesNuevas[0]?.valor).toBe('oc-a');
    });

    it('no deja salir todas las OC ni una que no está en la orden', async () => {
      const { service, consultas } = armar(fila(origen));

      await expect(
        service.dividir(
          ID_OV,
          { criterio: 'oc', valoresSalen: ['4502988065', '4502988746'] },
          ctx,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.dividir(ID_OV, { criterio: 'oc', valoresSalen: ['9999'] }, ctx),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(insercion(consultas)).toHaveLength(0);
    });
  });

  describe('por día de entrega', () => {
    const origen = [
      renglon('OC-1', 'Aguacate', { Fecha: '2026-11-07' }),
      renglon('OC-1', 'Limón', { Fecha: '2026-11-08', Almacen: 'BAR' }),
      renglon('OC-2', 'Piña', { Fecha: '2026-11-09' }),
    ];

    it('crea una OV por cada día que sale, con su propia fecha de entrega', async () => {
      const { service, consultas } = armar(fila(origen));

      const res = await service.dividir(
        ID_OV,
        { criterio: 'dia', valoresSalen: ['2026-11-08', '2026-11-09'] },
        ctx,
      );

      const nuevas = insercion(consultas);
      expect(nuevas).toHaveLength(2);
      expect(nuevas.map((n) => n.valores[3])).toEqual(['2026-11-08', '2026-11-09']);
      expect(res.ordenesNuevas.map((o) => o.valor)).toEqual(['2026-11-08', '2026-11-09']);
      expect(res.valoresQuedan).toEqual(['2026-11-07']);
      const actual = actualizacion(consultas);
      expect(actual.valores[2]).toBe('OC-1');
      expect(actual.valores[3]).toBe('2026-11-07');
    });

    it('si se quedan varios días no toca la fecha de la OV actual', async () => {
      const { service, consultas } = armar(fila(origen));

      await service.dividir(ID_OV, { criterio: 'dia', valoresSalen: ['2026-11-09'] }, ctx);

      expect(actualizacion(consultas).valores[3]).toBeNull();
    });

    it('una tarea es una unidad: no parte las filas de una misma OC y almacén', async () => {
      const { service, consultas } = armar(
        fila([
          renglon('OC-1', 'a', { Fecha: '2026-11-07' }),
          renglon('OC-1', 'b', { Fecha: '2026-11-07' }),
          renglon('OC-2', 'c', { Fecha: '2026-11-08' }),
        ]),
      );

      await service.dividir(ID_OV, { criterio: 'dia', valoresSalen: ['2026-11-08'] }, ctx);

      const [nueva] = insercion(consultas);
      expect(JSON.parse(nueva.valores[1] as string)).toHaveLength(1);
    });
  });

  describe('por horario de entrega', () => {
    it('la OV nueva toma la ventana de su horario', async () => {
      const { service, consultas } = armar(
        fila([
          renglon('OC-1', 'a', { 'Ventana desde': '06:00', 'Ventana hasta': '08:00' }),
          renglon('OC-2', 'b', {
            'Ventana desde': '14:00',
            'Ventana hasta': '16:00',
            Almacen: 'BAR',
          }),
        ]),
      );

      const res = await service.dividir(
        ID_OV,
        { criterio: 'horario', valoresSalen: ['14:00 - 16:00'] },
        ctx,
      );

      const [nueva] = insercion(consultas);
      expect(nueva.valores.slice(3)).toEqual([null, '14:00', '16:00']);
      expect(res.valoresQuedan).toEqual(['06:00 - 08:00']);
      expect(actualizacion(consultas).valores.slice(3)).toEqual([null, '06:00', '08:00']);
    });
  });

  it('las filas sin el dato del criterio se quedan en la orden actual', async () => {
    const { service, consultas } = armar(
      fila([renglon('OC-1', 'a', { Fecha: '' }), renglon('OC-2', 'b', { Fecha: '2026-11-08' })]),
    );

    const res = await service.dividir(
      ID_OV,
      { criterio: 'dia', valoresSalen: ['2026-11-08'] },
      ctx,
    );

    expect(res.valoresQuedan).toEqual([]);
    expect(
      (JSON.parse(actualizacion(consultas).valores[1] as string) as unknown[]).length,
    ).toBe(1);
  });

  it('solo divide órdenes por confirmar', async () => {
    const { service } = armar(fila([renglon('A', 'x'), renglon('B', 'y')], 'confirmada'));

    await expect(
      service.dividir(ID_OV, { criterio: 'oc', valoresSalen: ['B'] }, ctx),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('una OV inexistente o de otra cuenta responde 404', async () => {
    await expect(
      armar(null).service.dividir(ID_OV, { criterio: 'oc', valoresSalen: ['1'] }, ctx),
    ).rejects.toBeInstanceOf(NotFoundException);

    (assertOperationalTenantScope as jest.Mock).mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(
      armar(fila([renglon('A', 'x'), renglon('B', 'y')])).service.dividir(
        ID_OV,
        { criterio: 'oc', valoresSalen: ['B'] },
        ctx,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
