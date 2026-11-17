import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../../../core/database/prisma.service';
import type { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
import { CorreoIngresoRepository } from './correo-ingreso.repository';

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

const FILTRO = { modo: 'todos' as const, pagina: 1, tamano: 25 };

function conFilas(filas: unknown[], total = filas.length) {
  const montado = montar();
  montado.prisma.$queryRawUnsafe.mockImplementation((sql: string) =>
    Promise.resolve(/count\(\*\)/i.test(sql) ? [{ total }] : filas),
  );
  return montado;
}

const sqlDe = (prisma: ReturnType<typeof montar>['prisma'], i: number) =>
  (prisma.$queryRawUnsafe.mock.calls[i] as [string, ...unknown[]])[0];
const paramsDe = (prisma: ReturnType<typeof montar>['prisma'], i: number) =>
  (prisma.$queryRawUnsafe.mock.calls[i] as unknown[]).slice(1);

describe('CorreoIngresoRepository entradas (REQ-314, REQ-318)', () => {
  describe('listarEntradas', () => {
    it('descartados excluye en SQL los ya ingresados a mano', async () => {
      const { repo, prisma } = conFilas([]);

      await repo.listarEntradas('emp_demo', '023WA', {
        ...FILTRO,
        modo: 'descartados',
      });

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
      for (const i of [0, 1]) {
        expect(sqlDe(prisma, i)).toContain(
          '"emp_demo".correo_pedido_entrada e',
        );
        expect(sqlDe(prisma, i)).toContain(
          'NOT EXISTS (SELECT 1 FROM "emp_demo".correo_pedido_ingreso i',
        );
      }
    });

    it('procesados trae en SQL los del workflow o ingresados a mano', async () => {
      const { repo, prisma } = conFilas([]);

      await repo.listarEntradas('emp_demo', '023WA', {
        ...FILTRO,
        modo: 'procesados',
      });

      expect(sqlDe(prisma, 1)).toContain('IS DISTINCT FROM false OR EXISTS');
    });
  });

  describe('buscarEntrada', () => {
    it('consulta un correo de la lista por cuenta y messageId', async () => {
      const fila = { messageId: 'abc123def', nuevoPedido: false };
      const { repo, prisma } = montar();
      prisma.$queryRawUnsafe.mockResolvedValue([fila]);

      const resultado = await repo.buscarEntrada(
        'emp_demo',
        '023WA',
        'abc123def',
      );

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      const sql = sqlDe(prisma, 0);
      expect(sql).toContain('"emp_demo".correo_pedido_entrada');
      expect(sql).toContain('codigo_cuenta = $1');
      expect(sql).toContain('message_id = $2');
      expect(sql).toContain(
        'ORDER BY recibido_en DESC NULLS LAST, created_at DESC',
      );
      expect(sql).toContain('LIMIT 1');
      expect(paramsDe(prisma, 0)).toEqual(['023WA', 'abc123def']);
      expect(resultado).toEqual(fila);
    });

    it('sin filas devuelve null', async () => {
      const { repo, prisma } = montar();
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      await expect(
        repo.buscarEntrada('emp_demo', '023WA', 'abc123def'),
      ).resolves.toBeNull();
    });

    it.each([
      ['vacío', ''],
      ['solo espacios', '   '],
    ])('con cuenta %s rechaza y no consulta', async (_caso, cuenta) => {
      const { repo, prisma } = montar();

      await expect(
        repo.buscarEntrada('emp_demo', cuenta, 'abc123def'),
      ).rejects.toThrow(/cuenta/i);
      expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('cuando prisma falla responde 503 CORREOS_LECTURA_FALLIDA', async () => {
      const registro = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const { repo, prisma } = montar();
      prisma.$queryRawUnsafe.mockRejectedValue(new Error('connection refused'));

      const intento = repo.buscarEntrada('emp_demo', '023WA', 'abc123def');

      await expect(intento).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(intento).rejects.toMatchObject({
        response: { error: 'CORREOS_LECTURA_FALLIDA' },
      });
      registro.mockRestore();
    });
  });

  describe('ingresoDeEntrada', () => {
    it('devuelve el primer ingreso', async () => {
      const primero = { messageId: 'abc123def', estado: 'ingresado' };
      const { repo, prisma } = montar();
      prisma.$queryRawUnsafe.mockResolvedValue([
        primero,
        { messageId: 'otro', estado: 'error' },
      ]);

      await expect(
        repo.ingresoDeEntrada('emp_demo', '023WA', 'abc123def'),
      ).resolves.toEqual(primero);
    });

    it('sin filas devuelve undefined', async () => {
      const { repo, prisma } = montar();
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      await expect(
        repo.ingresoDeEntrada('emp_demo', '023WA', 'abc123def'),
      ).resolves.toBeUndefined();
    });

    it.each([
      ['vacío', ''],
      ['solo espacios', '   '],
    ])('con cuenta %s rechaza y no consulta', async (_caso, cuenta) => {
      const { repo, prisma } = montar();

      await expect(
        repo.ingresoDeEntrada('emp_demo', cuenta, 'abc123def'),
      ).rejects.toThrow(/cuenta/i);
      expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('cuando prisma falla responde 503 CORREOS_LECTURA_FALLIDA', async () => {
      const registro = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const { repo, prisma } = montar();
      prisma.$queryRawUnsafe.mockRejectedValue(new Error('connection refused'));

      const intento = repo.ingresoDeEntrada('emp_demo', '023WA', 'abc123def');

      await expect(intento).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(intento).rejects.toMatchObject({
        response: { error: 'CORREOS_LECTURA_FALLIDA' },
      });
      registro.mockRestore();
    });
  });
});
