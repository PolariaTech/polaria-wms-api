import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolNivel, WmsRol } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantService } from './tenant.service';

describe('TenantService.buildContext', () => {
  const prisma = {
    usuario: {
      findFirst: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };

  const service = new TenantService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lee cuentas y asignaciones en emp_* con SQL calificado', async () => {
    prisma.usuario.findFirst.mockResolvedValue({
      idUsuario: 'usr-1',
      idRol: WmsRol.administrador_bodega,
      codigoEmpresa: '1XZ77',
      codigoCuenta: '1YW43',
      rol: { nivel: RolNivel.bodega },
      empresa: {
        estaActiva: true,
        schemaName: 'emp_demo_1xz77',
      },
      cuenta: null,
      asignacionesBodega: [],
    });
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ estaActiva: true }])
      .mockResolvedValueOnce([{ codigoCuenta: '1YW43' }])
      .mockResolvedValueOnce([{ idBodega: 'bodega-demo' }]);

    const ctx = await service.buildContext('auth-1');

    expect(ctx.idBodegas).toEqual(['bodega-demo']);
    expect(ctx.codigosCuentaEmpresa).toEqual(['1YW43']);
    expect(ctx.schemaName).toBe('emp_demo_1xz77');
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FROM emp_demo_1xz77.cuenta'),
      '1YW43',
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('FROM emp_demo_1xz77.asignacion_bodega'),
      'usr-1',
    );
  });

  it('usa asignaciones de include Prisma cuando schema_name es null (Tecno)', async () => {
    prisma.usuario.findFirst.mockResolvedValue({
      idUsuario: 'usr-tecno',
      idRol: WmsRol.operario,
      codigoEmpresa: 'EVU53',
      codigoCuenta: 'TECN1',
      rol: { nivel: RolNivel.bodega },
      empresa: {
        estaActiva: true,
        schemaName: null,
      },
      cuenta: { estaActiva: true },
      asignacionesBodega: [{ idBodega: 'bodega-public' }],
    });
    prisma.$queryRawUnsafe.mockResolvedValue([
      { codigoCuenta: 'TECN1' },
    ]);

    const ctx = await service.buildContext('auth-tecno');

    expect(ctx.idBodegas).toEqual(['bodega-public']);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FROM public.cuenta'),
      'EVU53',
    );
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalledWith(
      expect.stringContaining('asignacion_bodega'),
      expect.anything(),
    );
  });

  it('rechaza usuario inexistente', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);

    await expect(service.buildContext('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza cuenta inactiva en emp_*', async () => {
    prisma.usuario.findFirst.mockResolvedValue({
      idUsuario: 'usr-1',
      idRol: WmsRol.operador_cuenta,
      codigoEmpresa: '1XZ77',
      codigoCuenta: '1YW43',
      rol: { nivel: RolNivel.cuenta },
      empresa: {
        estaActiva: true,
        schemaName: 'emp_demo_1xz77',
      },
      cuenta: null,
      asignacionesBodega: [],
    });
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ estaActiva: false }]);

    await expect(service.buildContext('auth-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
