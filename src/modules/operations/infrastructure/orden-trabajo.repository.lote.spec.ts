import type { CreateOrdenTrabajoInput } from '../interfaces/operations.interfaces';
import { OrdenTrabajoRepository } from './orden-trabajo.repository';

describe('OrdenTrabajoRepository.createLoteInTransaction', () => {
  const SCHEMA = 'emp_demo';

  const base: CreateOrdenTrabajoInput = {
    codigoCuenta: 'CTA1',
    idBodega: 'bodega-1',
    tipoFlujo: 'a_salida',
    idOrdenVenta: 'ov-1',
    observaciones: 'OV OV-1',
  };

  function crearRepositorio(): OrdenTrabajoRepository {
    const locator = { assertSafeSchemaIdent: (nombre: string) => nombre };
    return new OrdenTrabajoRepository({} as never, locator as never);
  }

  /** Cliente de transacción falso: apunta cada sentencia y sus parámetros. */
  function crearTransaccion(ultimoFolio: number) {
    const sentencias: string[] = [];
    const parametros: unknown[][] = [];
    const consultar = jest.fn((sql: string, ...valores: unknown[]) => {
      sentencias.push(sql);
      parametros.push(valores);
      if (sql.includes(`INSERT INTO ${SCHEMA}.contador`)) {
        return Promise.resolve([{ valor: BigInt(ultimoFolio) }]);
      }
      if (sql.includes(`INSERT INTO ${SCHEMA}.orden_trabajo (`)) {
        const nuevas = JSON.parse(valores[8] as string) as Array<{
          codigo: string;
        }>;
        return Promise.resolve(
          nuevas.map((nueva, indice) => ({
            idOrdenTrabajo: `ot-${indice}`,
            codigo: nueva.codigo,
          })),
        );
      }
      return Promise.resolve([]);
    });
    const ejecutar = jest.fn((sql: string, ...valores: unknown[]) => {
      sentencias.push(sql);
      parametros.push(valores);
      return Promise.resolve(1);
    });
    return {
      transaccion: { $queryRawUnsafe: consultar, $executeRawUnsafe: ejecutar },
      sentencias,
      parametros,
    };
  }

  const entradas = (cantidad: number): CreateOrdenTrabajoInput[] =>
    Array.from({ length: cantidad }, (_valor, indice) => ({
      ...base,
      idProducto: `producto-${indice}`,
      cantidad: 2,
      idUbicacionOrigen: `ubicacion-${indice}`,
      idLote: indice % 2 === 0 ? `lote-${indice}` : undefined,
    }));

  it('no consulta nada si no hay OT que crear', async () => {
    const { transaccion, sentencias } = crearTransaccion(0);

    const codigos = await crearRepositorio().createLoteInTransaction(
      transaccion as never,
      [],
      'usuario-1',
      { schemaName: SCHEMA },
    );

    expect(codigos).toEqual([]);
    expect(sentencias).toHaveLength(0);
  });

  it('crea 200 OT con 5 sentencias y folios seguidos', async () => {
    const { transaccion, sentencias, parametros } = crearTransaccion(300);

    const codigos = await crearRepositorio().createLoteInTransaction(
      transaccion as never,
      entradas(200),
      'usuario-1',
      { schemaName: SCHEMA },
    );

    // candado del folio, contador, OT, líneas y tareas
    expect(sentencias).toHaveLength(5);
    expect(codigos).toHaveLength(200);
    expect(codigos[0]).toBe('OT-000101');
    expect(codigos[199]).toBe('OT-000300');
    expect(new Set(codigos).size).toBe(200);

    const tareas = JSON.parse(parametros[4]?.[5] as string) as Array<{
      id_orden_trabajo: string;
      titulo: string;
    }>;
    expect(tareas).toHaveLength(200);
    expect(tareas[0]?.titulo).toBe('A salida · OT-000101');
  });

  it('rechaza un lote cuyas OT no comparten cuenta, flujo u orden de venta', async () => {
    const { transaccion, sentencias } = crearTransaccion(10);
    const mezcladas = [
      { ...base, idProducto: 'producto-1', cantidad: 1 },
      { ...base, idOrdenVenta: 'ov-2', idProducto: 'producto-2', cantidad: 1 },
    ];

    await expect(
      crearRepositorio().createLoteInTransaction(
        transaccion as never,
        mezcladas,
        'usuario-1',
        { schemaName: SCHEMA },
      ),
    ).rejects.toThrow('OT_LOTE_NO_UNIFORME');
    expect(sentencias).toHaveLength(0);
  });

  it('omite el INSERT de líneas si ninguna OT trae producto y cantidad', async () => {
    const { transaccion, sentencias } = crearTransaccion(2);

    await crearRepositorio().createLoteInTransaction(
      transaccion as never,
      [base, base],
      'usuario-1',
      { schemaName: SCHEMA },
    );

    expect(sentencias).toHaveLength(4);
    expect(sentencias.some((sql) => sql.includes('orden_trabajo_linea'))).toBe(
      false,
    );
  });
});
