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

describe('CorreoIngresoRepository vencimiento (POL-415)', () => {
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
});
