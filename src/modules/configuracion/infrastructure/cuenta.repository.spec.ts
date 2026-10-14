import { PrismaService } from '../../../core/database/prisma.service';
import { CuentaRepository } from './cuenta.repository';

describe('CuentaRepository', () => {
  const prisma = {
    empresa: {
      findMany: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  };

  const repository = new CuentaRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('encuentra la cuenta en emp_* con SQL calificado', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          codigoCuenta: '4V053',
          codigoEmpresa: '4V053',
          nombreComercial: 'Andino',
          estaActiva: true,
          accesoWms: true,
          accesoMateo: false,
          idBodegaDefault: null,
        },
      ]);
    prisma.empresa.findMany.mockResolvedValue([
      { schemaName: 'emp_andino_4v053' },
    ]);

    const found = await repository.findByCodigo('4V053');

    expect(found?.schemaName).toBe('emp_andino_4v053');
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FROM emp_andino_4v053.cuenta'),
      '4V053',
    );
  });

  it('actualiza acceso_wms en el schema tenant', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        codigoCuenta: '4V053',
        codigoEmpresa: '4V053',
        nombreComercial: 'Andino',
        estaActiva: true,
        accesoWms: true,
        accesoMateo: false,
        idBodegaDefault: null,
      },
    ]);

    await repository.update(
      '4V053',
      { accesoWms: true, accesoMateo: false },
      'emp_andino_4v053',
    );

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE emp_andino_4v053.cuenta'),
      true,
      false,
      '4V053',
    );
  });

  it('lista bodegas activas en emp_*', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ idBodega: 'b1' }]);

    const rows = await repository.findBodegasActivasDeCuenta(
      '1YW43',
      'emp_demo_1xz77',
    );

    expect(rows).toEqual([{ idBodega: 'b1' }]);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FROM emp_demo_1xz77.bodega'),
      '1YW43',
    );
  });

  it('asigna bodegas con UPDATE en emp_*', async () => {
    prisma.$executeRawUnsafe.mockResolvedValue(2);

    const result = await repository.assignBodegasToCuenta(
      '1YW43',
      ['b1', 'b2'],
      'emp_demo_1xz77',
    );

    expect(result).toEqual({ count: 2 });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE emp_demo_1xz77.bodega'),
      '1YW43',
      ['b1', 'b2'],
    );
  });

  it('asigna bodegas en public cuando schema_name es null (Tecno)', async () => {
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    await repository.assignBodegasToCuenta('CTA01', ['b1'], null);

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE public.bodega'),
      'CTA01',
      ['b1'],
    );
  });

  it('findBodegasByIds usa JOIN calificado en emp_*', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        idBodega: 'b1',
        codigoCuenta: '1YW43',
        codigoEmpresa: '1XZ77',
      },
    ]);

    const rows = await repository.findBodegasByIds(
      ['b1'],
      'emp_demo_1xz77',
    );

    expect(rows).toEqual([
      {
        idBodega: 'b1',
        codigoCuenta: '1YW43',
        cuenta: { codigoEmpresa: '1XZ77' },
      },
    ]);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FROM emp_demo_1xz77.bodega'),
      ['b1'],
    );
  });
});
