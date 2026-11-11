import { Logger, ServiceUnavailableException } from '@nestjs/common';
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

      expect(resultado.reservada).toBe(true);
      expect(resultado.fila).toEqual(FILA);
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
      expect(sql).toContain("interval '7 minutes'");
      expect(sql).toContain('intentos');
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

      expect(resultado).toEqual({
        reservada: false,
        fila: existente,
        numeroIntentos: 0,
      });
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
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

  it('marcarIngresado guarda la OV por cuenta y correo y cierra el último intento', async () => {
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
    expect(sql).toContain('jsonb_set');
    expect(sql).toContain("'ingresado'");
    expect(params).toEqual(['023WA', 'abc123def', 'ov-uuid', 'OV-00001319']);
  });

  it('marcarError recorta el mensaje a 500 caracteres y cierra el último intento', async () => {
    const { repo, prisma } = montar();
    await repo.marcarError({
      schemaName: 'emp_demo',
      codigoCuenta: '023WA',
      messageId: 'abc123def',
      error: 'x'.repeat(900),
    });
    const [sql, ...params] = prisma.$executeRawUnsafe.mock.calls[0] as [
      string,
      ...unknown[],
    ];
    expect((params[2] as string).length).toBe(500);
    expect(sql).toContain('jsonb_set');
    expect(sql).toContain("'error'");
  });

  it('listarPorMessageIds no consulta con una lista vacía', async () => {
    const { repo, prisma } = montar();
    await expect(
      repo.listarPorMessageIds('emp_demo', '023WA', []),
    ).resolves.toEqual([]);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  describe('listarEntradas (POL-410)', () => {
    const FILTRO = { modo: 'todos' as const, pagina: 1, tamano: 25 };

    /** Responde el conteo y la página según lo que pide el SQL. */
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

    it('lee de correo_pedido_entrada del esquema de la empresa, siempre filtrado por cuenta', async () => {
      const { repo, prisma } = conFilas([]);

      await repo.listarEntradas('emp_demo', '023WA', FILTRO);

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
      for (const i of [0, 1]) {
        expect(sqlDe(prisma, i)).toContain('"emp_demo".correo_pedido_entrada');
        expect(sqlDe(prisma, i)).toContain('codigo_cuenta = $1');
        expect(paramsDe(prisma, i)[0]).toBe('023WA');
      }
    });

    it.each([
      ['vacío', ''],
      ['solo espacios', '   '],
    ])(
      'no consulta nada si falta la cuenta (%s): sin filtro por cuenta se verían los correos de todas',
      async (_caso, cuenta) => {
        const { repo, prisma } = conFilas([]);

        await expect(
          repo.listarEntradas('emp_demo', cuenta, FILTRO),
        ).rejects.toThrow(/cuenta/i);
        expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
      },
    );

    it('devuelve el total y las filas con los nombres del contrato', async () => {
      const fila = { messageId: 'abc123def', resultado: null };
      const { repo } = conFilas([fila], 41);

      const resultado = await repo.listarEntradas('emp_demo', '023WA', FILTRO);

      expect(resultado).toEqual({ total: 41, filas: [fila] });
    });

    it('pagina en SQL, de la más reciente a la más antigua', async () => {
      const { repo, prisma } = conFilas([]);

      await repo.listarEntradas('emp_demo', '023WA', {
        ...FILTRO,
        pagina: 3,
        tamano: 10,
      });

      const sql = sqlDe(prisma, 1);
      expect(sql).toMatch(/ORDER BY recibido_en DESC/i);
      expect(sql).toMatch(/LIMIT \$\d+ OFFSET \$\d+/);
      expect(paramsDe(prisma, 1)).toEqual(expect.arrayContaining([10, 20]));
    });

    it('el modo descartados solo trae los que el workflow descartó', async () => {
      const { repo, prisma } = conFilas([]);

      await repo.listarEntradas('emp_demo', '023WA', {
        ...FILTRO,
        modo: 'descartados',
      });

      expect(sqlDe(prisma, 1)).toContain('nuevo_pedido = false');
      expect(sqlDe(prisma, 0)).toContain('nuevo_pedido = false');
    });

    it('el modo todos no filtra por nuevo_pedido', async () => {
      const { repo, prisma } = conFilas([]);

      await repo.listarEntradas('emp_demo', '023WA', FILTRO);

      expect(sqlDe(prisma, 0)).not.toContain('nuevo_pedido');
      expect(sqlDe(prisma, 1)).not.toContain('nuevo_pedido = ');
    });

    it('filtra por fechas, remitente y asunto con parámetros, nunca en el texto del SQL', async () => {
      const { repo, prisma } = conFilas([]);

      await repo.listarEntradas('emp_demo', '023WA', {
        ...FILTRO,
        desde: '2026-11-01T00:00:00.000Z',
        hasta: '2026-11-09T23:59:59.000Z',
        remitente: 'hotel',
        asunto: 'pedido',
      });

      const sql = sqlDe(prisma, 1);
      expect(sql).toMatch(/recibido_en >= \$\d+/);
      expect(sql).toMatch(/recibido_en <= \$\d+/);
      expect(sql).toMatch(/de ILIKE \$\d+/);
      expect(sql).toMatch(/asunto ILIKE \$\d+/);
      expect(sql).not.toContain('hotel');
      expect(paramsDe(prisma, 1)).toEqual(
        expect.arrayContaining(['%hotel%', '%pedido%']),
      );
    });

    it('un % o un _ escritos por el usuario se buscan tal cual, no como comodín', async () => {
      const { repo, prisma } = conFilas([]);

      await repo.listarEntradas('emp_demo', '023WA', {
        ...FILTRO,
        remitente: '100%_a\\b',
      });

      expect(paramsDe(prisma, 1)).toContain('%100\\%\\_a\\\\b%');
    });

    it('usa public cuando la cuenta no tiene esquema propio', async () => {
      const { repo, prisma } = conFilas([]);

      await repo.listarEntradas(null, '023WA', FILTRO);

      expect(sqlDe(prisma, 1)).toContain('"public".correo_pedido_entrada');
    });

    it('rechaza un nombre de esquema inseguro', async () => {
      const { repo, locator } = conFilas([]);
      locator.assertSafeSchemaIdent.mockImplementation(() => {
        throw new Error('esquema inválido');
      });

      await expect(
        repo.listarEntradas('x"; DROP TABLE y;--', '023WA', FILTRO),
      ).rejects.toThrow('esquema inválido');
    });

    describe('cuando la base falla', () => {
      const FALLO = new Error('connection refused to db.interna:5432');
      let registro: jest.SpyInstance;

      beforeEach(() => {
        registro = jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation(() => undefined);
      });
      afterEach(() => {
        registro.mockRestore();
      });

      it('responde 503 con un mensaje claro, sin detalles de la base', async () => {
        const { repo, prisma } = montar();
        prisma.$queryRawUnsafe.mockRejectedValue(FALLO);

        const intento = repo.listarEntradas('emp_demo', '023WA', FILTRO);

        await expect(intento).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );
        await expect(intento).rejects.toMatchObject({
          response: {
            error: 'CORREOS_LECTURA_FALLIDA',
            message:
              'No se pudo leer la lista de correos. Intenta de nuevo en unos minutos.',
          },
        });
        await expect(intento).rejects.not.toThrow(/connection refused/);
      });

      it('deja el error real en el registro para soporte', async () => {
        const { repo, prisma } = montar();
        prisma.$queryRawUnsafe.mockRejectedValue(FALLO);

        await expect(
          repo.listarEntradas('emp_demo', '023WA', FILTRO),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);

        expect(registro).toHaveBeenCalledTimes(1);
        expect(String(registro.mock.calls[0][0])).toContain(
          'connection refused',
        );
      });

      it('también responde 503 si falla solo una de las dos consultas', async () => {
        const { repo, prisma } = montar();
        prisma.$queryRawUnsafe.mockImplementation((sql: string) =>
          /count\(\*\)/i.test(sql)
            ? Promise.resolve([{ total: 3 }])
            : Promise.reject(FALLO),
        );

        await expect(
          repo.listarEntradas('emp_demo', '023WA', FILTRO),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
      });
    });
  });
});
