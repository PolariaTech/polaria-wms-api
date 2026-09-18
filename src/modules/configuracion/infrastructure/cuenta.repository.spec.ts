import { PrismaService } from '../../../core/database/prisma.service';
import { CuentaRepository } from './cuenta.repository';

describe('CuentaRepository', () => {
  const prisma = {
    forSchema: jest.fn(),
    $queryRawUnsafe: jest.fn(),
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
    prisma.forSchema.mockReturnValue({
      empresa: {
        findMany: jest.fn().mockResolvedValue([
          { schemaName: 'emp_andino_4v053' },
        ]),
      },
    });

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
});
