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

  it('listarPorMessageIds vence los procesando viejos y trae varios correos en una consulta', async () => {
    const { repo, prisma } = montar();
    const vencido = {
      ...FILA,
      estado: 'error' as const,
      error: 'El ingreso no terminó. Toca Reintentar.',
    };
    prisma.$queryRawUnsafe.mockResolvedValueOnce([vencido]);
    const resultado = await repo.listarPorMessageIds('emp_demo', '023WA', [
      'a',
      'b',
    ]);
    expect(resultado).toEqual([vencido]);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    const sqlExpirar = prisma.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(sqlExpirar).toMatch(/UPDATE .*correo_pedido_ingreso/s);
    expect(sqlExpirar).toContain("estado = 'error'");
    expect(sqlExpirar).toContain("interval '7 minutes'");
    expect(sqlExpirar).toContain("estado = 'procesando'");
    expect(sqlExpirar).toContain('codigo_cuenta = $1');
    expect(sqlExpirar).toContain('$4::text');
    expect(
      (prisma.$executeRawUnsafe.mock.calls[0] as unknown[]).slice(1),
    ).toEqual([
      '023WA',
      ['a', 'b'],
      'El ingreso no terminó. Toca Reintentar.',
      'El ingreso no terminó',
    ]);
    expect(
      (prisma.$queryRawUnsafe.mock.calls[0] as unknown[]).slice(1),
    ).toEqual(['023WA', ['a', 'b']]);
  });

  it('buscar vence un procesando de más de 7 min antes de devolverlo', async () => {
    const { repo, prisma } = montar();
    const vencido = {
      ...FILA,
      estado: 'error' as const,
      error: 'El ingreso no terminó. Toca Reintentar.',
    };
    prisma.$queryRawUnsafe.mockResolvedValueOnce([vencido]);

    const resultado = await repo.buscar('emp_demo', '023WA', 'abc123def');

    expect(resultado).toEqual(vencido);
    const sqlExpirar = prisma.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(sqlExpirar).toContain("interval '7 minutes'");
    expect(sqlExpirar).toContain("'vencido'");
    expect(sqlExpirar).toContain('jsonb_set');
    expect(sqlExpirar).toContain('$4::text');
  });

  it('un procesando de menos de 7 min se sigue leyendo como procesando', async () => {
    const { repo, prisma } = montar();
    prisma.$queryRawUnsafe.mockResolvedValueOnce([FILA]);

    const resultado = await repo.listarPorMessageIds('emp_demo', '023WA', [
      'abc123def',
    ]);

    expect(resultado[0].estado).toBe('procesando');
    expect(resultado[0].error).toBeNull();
    const sqlExpirar = prisma.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(sqlExpirar).toContain("updated_at < now() - interval '7 minutes'");
  });

  it('buscarOvsPorNumeroCorreo filtra por cuenta y sello de origen_correo', async () => {
    const { repo, prisma } = montar();
    prisma.$queryRawUnsafe.mockResolvedValue([
      { idOrdenVenta: 'ov-1', codigo: 'OV-1' },
      { idOrdenVenta: 'ov-2', codigo: 'OV-2' },
    ]);

    const ovs = await repo.buscarOvsPorNumeroCorreo(
      'emp_demo',
      '023WA',
      'abc123def',
    );

    expect(ovs).toEqual([
      { idOrdenVenta: 'ov-1', codigo: 'OV-1' },
      { idOrdenVenta: 'ov-2', codigo: 'OV-2' },
    ]);
    const [sql, ...params] = prisma.$queryRawUnsafe.mock.calls[0] as [
      string,
      ...unknown[],
    ];
    expect(sql).toContain('"emp_demo".orden_venta');
    expect(sql).toContain('codigo_cuenta = $1');
    expect(sql).toContain('origen_correo @>');
    expect(params[0]).toBe('023WA');
    expect(params[1]).toEqual([{ 'Numero correo': 'abc123def' }]);
  });

  /**
   * $n dentro de jsonb_build_object sin ::tipo, y sin otra aparición fuera
   * (Postgres no infiere el tipo: 42P18).
   */
  function parametrosJsonbSinTipo(sql: string): string[] {
    const rangos: Array<[number, number]> = [];
    let pos = 0;
    while (pos < sql.length) {
      const inicio = sql.indexOf('jsonb_build_object', pos);
      if (inicio < 0) break;
      const abre = sql.indexOf('(', inicio);
      if (abre < 0) break;
      let profundidad = 0;
      let fin = abre;
      for (let i = abre; i < sql.length; i += 1) {
        if (sql[i] === '(') profundidad += 1;
        else if (sql[i] === ')') {
          profundidad -= 1;
          if (profundidad === 0) {
            fin = i;
            break;
          }
        }
      }
      rangos.push([abre, fin]);
      pos = fin + 1;
    }
    const enJsonb = (indice: number) =>
      rangos.some(([desde, hasta]) => indice >= desde && indice <= hasta);
    const porNumero = new Map<
      string,
      { fuera: boolean; dentroSinCast: boolean }
    >();
    for (const hallazgo of sql.matchAll(/\$(\d+)(::[A-Za-z_]\w*)?/g)) {
      const numero = hallazgo[1];
      const indice = hallazgo.index ?? 0;
      const actual = porNumero.get(numero) ?? {
        fuera: false,
        dentroSinCast: false,
      };
      if (enJsonb(indice)) {
        if (!hallazgo[2]) actual.dentroSinCast = true;
      } else {
        actual.fuera = true;
      }
      porNumero.set(numero, actual);
    }
    return [...porNumero.entries()]
      .filter(([, uso]) => uso.dentroSinCast && !uso.fuera)
      .map(([numero]) => `$${numero}`);
  }

  it('expirarVencidos tipa $4 como text dentro de jsonb_build_object', async () => {
    const { repo, prisma } = montar();
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    await repo.listarPorMessageIds('emp_demo', '023WA', ['abc123def']);
    const sql = prisma.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('$4::text');
    expect(parametrosJsonbSinTipo(sql)).toEqual([]);
  });

  it('ningún SQL con jsonb_build_object deja un $n sin tipo ni aparición previa', async () => {
    const { repo, prisma } = montar();
    prisma.$queryRawUnsafe.mockResolvedValue([FILA]);
    await repo.listarPorMessageIds('emp_demo', '023WA', ['abc123def']);
    await repo.marcarError({
      schemaName: 'emp_demo',
      codigoCuenta: '023WA',
      messageId: 'abc123def',
      error: 'fallo',
    });
    await repo.marcarIngresado({
      schemaName: 'emp_demo',
      codigoCuenta: '023WA',
      messageId: 'abc123def',
      idOrdenVenta: 'ov-uuid',
      codigoOrdenVenta: 'OV-1',
    });
    const sqls = [
      prisma.$executeRawUnsafe.mock.calls[0][0] as string,
      prisma.$executeRawUnsafe.mock.calls[1][0] as string,
      prisma.$executeRawUnsafe.mock.calls[2][0] as string,
    ];
    for (const sql of sqls) {
      expect(sql).toContain('jsonb_build_object');
      expect(parametrosJsonbSinTipo(sql)).toEqual([]);
    }
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
