import type { CreateOrdenTrabajoInput } from '../interfaces/operations.interfaces';
import { crearLoteOt, reservarFolios } from './orden-trabajo-lote';

const SCHEMA = 'emp_demo';

const base: CreateOrdenTrabajoInput = {
  codigoCuenta: 'CTA1',
  idBodega: 'bodega-1',
  tipoFlujo: 'a_salida',
  idOrdenVenta: 'ov-1',
  observaciones: 'OV OV-1',
};

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

describe('reservarFolios', () => {
  it('devuelve los folios seguidos que terminan en el último reservado', async () => {
    const { transaccion, sentencias } = crearTransaccion(12);

    const folios = await reservarFolios(
      transaccion as never,
      SCHEMA,
      'CTA1',
      'bodega-1',
      3,
    );

    expect(folios).toEqual(['OT-000010', 'OT-000011', 'OT-000012']);
    // candado del folio y contador
    expect(sentencias).toHaveLength(2);
  });

  it('pide al contador la cantidad completa en una sola sentencia', async () => {
    const { transaccion, parametros } = crearTransaccion(300);

    await reservarFolios(transaccion as never, SCHEMA, 'CTA1', 'bodega-1', 200);

    expect(parametros[1]).toEqual(['CTA1', 'bodega-1', 'orden_trabajo', '200']);
  });

  it('falla si el contador no devuelve valor', async () => {
    const transaccion = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    await expect(
      reservarFolios(transaccion as never, SCHEMA, 'CTA1', 'bodega-1', 1),
    ).rejects.toThrow('No se pudo obtener contador de OT');
  });
});

describe('crearLoteOt', () => {
  it('no consulta nada si no hay OT que crear', async () => {
    const { transaccion, sentencias } = crearTransaccion(0);

    const codigos = await crearLoteOt(
      transaccion as never,
      SCHEMA,
      [],
      'usuario-1',
    );

    expect(codigos).toEqual([]);
    expect(sentencias).toHaveLength(0);
  });

  it('crea 200 OT con 5 sentencias y folios seguidos', async () => {
    const { transaccion, sentencias, parametros } = crearTransaccion(300);

    const codigos = await crearLoteOt(
      transaccion as never,
      SCHEMA,
      entradas(200),
      'usuario-1',
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

  it('escribe observaciones, tipo y orden de venta una sola vez para todo el lote', async () => {
    const { transaccion, parametros } = crearTransaccion(2);

    await crearLoteOt(transaccion as never, SCHEMA, entradas(2), 'usuario-1');

    const ordenes = parametros[2] ?? [];
    expect(ordenes.slice(0, 8)).toEqual([
      'CTA1',
      'bodega-1',
      'picking',
      'usuario-1',
      null,
      null,
      'ov-1',
      'flujo:a_salida|OV OV-1',
    ]);
  });

  it('rechaza un lote cuyas OT no comparten cuenta, flujo u orden de venta', async () => {
    const { transaccion, sentencias } = crearTransaccion(10);
    const mezcladas = [
      { ...base, idProducto: 'producto-1', cantidad: 1 },
      { ...base, idOrdenVenta: 'ov-2', idProducto: 'producto-2', cantidad: 1 },
    ];

    await expect(
      crearLoteOt(transaccion as never, SCHEMA, mezcladas, 'usuario-1'),
    ).rejects.toThrow('OT_LOTE_NO_UNIFORME');
    expect(sentencias).toHaveLength(0);
  });

  it('omite el INSERT de líneas si ninguna OT trae producto y cantidad', async () => {
    const { transaccion, sentencias } = crearTransaccion(2);

    await crearLoteOt(transaccion as never, SCHEMA, [base, base], 'usuario-1');

    expect(sentencias).toHaveLength(4);
    expect(sentencias.some((sql) => sql.includes('orden_trabajo_linea'))).toBe(
      false,
    );
  });
});
