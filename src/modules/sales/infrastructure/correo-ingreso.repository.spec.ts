import type { PrismaService } from '../../../core/database/prisma.service';
import type { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
import {
  CorreoIngresoRepository,
  type CorreoIngresoFila,
} from './correo-ingreso.repository';

const FILA: CorreoIngresoFila = {
  idCorreoIngreso: 'c1',
  messageId: 'abc123def',
  estado: 'procesando',
  idOrdenVenta: null,
  codigoOrdenVenta: null,
  error: null,
};

function montar() {
  const prisma = {
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
  };
  const locator = {
    assertSafeSchemaIdent: jest.fn((esquema: string) => esquema),
  };
  const repo = new CorreoIngresoRepository(
    prisma as unknown as PrismaService,
    locator as unknown as TenantSchemaLocator,
  );
  return { repo, prisma, locator };
}

const base = {
  schemaName: 'emp_demo',
  codigoCuenta: '023WA',
  messageId: 'abc123def',
  hilo: null,
  ingresadoPor: 'user-1',
};

describe('CorreoIngresoRepository (REQ-104)', () => {
  describe('reservar', () => {
    it('gana la reserva cuando el INSERT devuelve la fila', async () => {
      const { repo, prisma } = montar();
      prisma.$queryRawUnsafe.mockResolvedValue([FILA]);

      const resultado = await repo.reservar(base);

      expect(resultado).toEqual({ reservada: true, fila: FILA });
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      const [sql, ...params] = prisma.$queryRawUnsafe.mock.calls[0] as [
        string,
        ...unknown[],
      ];
      expect(sql).toContain('"emp_demo".correo_pedido_ingreso');
      expect(sql).toContain(
        'ON CONFLICT (codigo_cuenta, message_id) DO UPDATE',
      );
      // solo recupera un error o un procesando abandonado, nunca uno ingresado
      expect(sql).toContain("c.estado = 'error'");
      expect(sql).toContain("interval '10 minutes'");
      expect(sql).not.toContain("estado = 'ingresado'");
      expect(params).toEqual(['023WA', 'abc123def', null, 'user-1']);
    });

    it('pierde la reserva cuando ya existe y devuelve la fila vigente', async () => {
      const { repo, prisma } = montar();
      const existente = {
        ...FILA,
        estado: 'ingresado' as const,
        codigoOrdenVenta: 'OV-1',
      };
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([existente]);

      const resultado = await repo.reservar(base);

      expect(resultado).toEqual({ reservada: false, fila: existente });
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it('falla si no reservó y tampoco encuentra la fila', async () => {
      const { repo, prisma } = montar();
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      await expect(repo.reservar(base)).rejects.toThrow('no quedó reservado');
    });

    it('usa public cuando la empresa no tiene schema propio', async () => {
      const { repo, prisma, locator } = montar();
      prisma.$queryRawUnsafe.mockResolvedValue([FILA]);

      await repo.reservar({ ...base, schemaName: null });

      expect(locator.assertSafeSchemaIdent).toHaveBeenCalledWith('public');
      expect((prisma.$queryRawUnsafe.mock.calls[0] as [string])[0]).toContain(
        '"public".correo_pedido_ingreso',
      );
    });
  });

  it('marcarIngresado guarda la OV por cuenta y correo', async () => {
    const { repo, prisma } = montar();
    await repo.marcarIngresado({
      schemaName: 'emp_demo',
      codigoCuenta: '023WA',
      messageId: 'abc123def',
      idOrdenVenta: 'ov-uuid',
      codigoOrdenVenta: 'OV-00001319',
    });
    const [sql, ...params] = prisma.$executeRawUnsafe.mock.calls[0] as [
      string,
      ...unknown[],
    ];
    expect(sql).toContain("estado = 'ingresado'");
    expect(sql).toContain('WHERE codigo_cuenta = $1 AND message_id = $2');
    expect(params).toEqual(['023WA', 'abc123def', 'ov-uuid', 'OV-00001319']);
  });

  it('marcarError recorta el mensaje a 500 caracteres', async () => {
    const { repo, prisma } = montar();
    await repo.marcarError({
      schemaName: 'emp_demo',
      codigoCuenta: '023WA',
      messageId: 'abc123def',
      error: 'x'.repeat(900),
    });
    const params = (prisma.$executeRawUnsafe.mock.calls[0] as unknown[]).slice(
      1,
    );
    expect((params[2] as string).length).toBe(500);
  });

  it('listarPorMessageIds no consulta con una lista vacía', async () => {
    const { repo, prisma } = montar();
    await expect(
      repo.listarPorMessageIds('emp_demo', '023WA', []),
    ).resolves.toEqual([]);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('listarPorMessageIds trae varios correos en una sola consulta', async () => {
    const { repo, prisma } = montar();
    prisma.$queryRawUnsafe.mockResolvedValue([FILA]);
    const resultado = await repo.listarPorMessageIds('emp_demo', '023WA', [
      'a',
      'b',
    ]);
    expect(resultado).toEqual([FILA]);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(
      (prisma.$queryRawUnsafe.mock.calls[0] as unknown[]).slice(1),
    ).toEqual(['023WA', ['a', 'b']]);
  });
});
