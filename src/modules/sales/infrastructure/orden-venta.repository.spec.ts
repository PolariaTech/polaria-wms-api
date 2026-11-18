import { Logger } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { OrdenTrabajoRepository } from '../../operations/infrastructure/orden-trabajo.repository';
import { OrdenVentaRepository, TX_EMITIR } from './orden-venta.repository';

const SCHEMA = 'emp_demo';

describe('OrdenVentaRepository.emitir', () => {
  const locator = { assertSafeSchemaIdent: (nombre: string) => nombre };

  function crearRepositorio(abrirTransaccion: jest.Mock): OrdenVentaRepository {
    return new OrdenVentaRepository(
      { $transaction: abrirTransaccion } as never,
      new OrdenTrabajoRepository({} as never, locator as never),
      locator as never,
    );
  }

  function ordenCon(cantidadLineas: number) {
    return {
      idOrdenVenta: 'ov-1',
      codigo: 'OV-1',
      codigoCuenta: 'CTA1',
      idBodega: 'bodega-1',
      idBodegaDestino: null,
      comprador: { nombre: 'Cliente' },
      lineas: Array.from({ length: cantidadLineas }, (_valor, indice) => ({
        idProducto: `producto-${indice}`,
        cantidadPedida: new Prisma.Decimal(1),
      })),
    };
  }

  /** Cliente de transacción falso que apunta cada sentencia que recibe. */
  function crearTransaccion(cantidadLineas: number) {
    const sentencias: string[] = [];
    const stock = Array.from({ length: cantidadLineas }, (_valor, indice) => ({
      idWarehouseState: `stock-${indice}`,
      idUbicacion: `ubicacion-${indice}`,
      idLote: null,
      idProducto: `producto-${indice}`,
      cantidad: new Prisma.Decimal(5),
      cantidadReservada: new Prisma.Decimal(0),
      fechaVencimiento: null,
    }));
    const consultar = jest.fn((sql: string, ...valores: unknown[]) => {
      sentencias.push(sql);
      if (sql.includes(`UPDATE ${SCHEMA}.orden_venta`)) {
        return Promise.resolve([{ idOrdenVenta: 'ov-1' }]);
      }
      if (sql.includes(`FROM ${SCHEMA}.warehouse_state ws`)) {
        return Promise.resolve(stock);
      }
      if (sql.includes(`INSERT INTO ${SCHEMA}.contador`)) {
        return Promise.resolve([{ valor: BigInt(100 + Number(valores[3])) }]);
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
    const ejecutar = jest.fn((sql: string) => {
      sentencias.push(sql);
      return Promise.resolve(1);
    });
    return {
      sentencias,
      transaccion: { $queryRawUnsafe: consultar, $executeRawUnsafe: ejecutar },
    };
  }

  /** Corre `emitir` con un `$transaction` que ejecuta el callback con la transacción falsa. */
  async function emitirConLineas(cantidadLineas: number) {
    const { transaccion, sentencias } = crearTransaccion(cantidadLineas);
    const repositorio = crearRepositorio(
      jest.fn((callback: (cliente: unknown) => unknown) =>
        callback(transaccion),
      ),
    );
    jest
      .spyOn(
        repositorio as unknown as { loadOrdenVenta: () => Promise<unknown> },
        'loadOrdenVenta',
      )
      .mockResolvedValue({ idOrdenVenta: 'ov-1' });
    jest
      .spyOn(repositorio, 'toEmitirResponse')
      .mockReturnValue({ idOrdenVenta: 'ov-1' } as never);

    await repositorio.emitir(
      ordenCon(cantidadLineas) as never,
      'usuario-1',
      SCHEMA,
    );
    return sentencias;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('abre la transacción con un tope menor al corte de 30 s del proxy', async () => {
    const abrirTransaccion = jest
      .fn()
      .mockResolvedValue({ idOrdenVenta: 'ov-1' });
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await crearRepositorio(abrirTransaccion).emitir(
      ordenCon(2) as never,
      'usuario-1',
      SCHEMA,
    );

    expect(abrirTransaccion).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 5_000,
      timeout: 20_000,
    });
    expect(TX_EMITIR.timeout).toBeLessThan(30_000);
  });

  it('registra las OT creadas y el tiempo, y deja pasar el error', async () => {
    const error = new Error('Transaction API error');
    const advertir = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await expect(
      crearRepositorio(jest.fn().mockRejectedValue(error)).emitir(
        ordenCon(2) as never,
        'usuario-1',
        SCHEMA,
      ),
    ).rejects.toBe(error);

    expect(advertir).toHaveBeenCalledWith(
      expect.stringContaining('emitir OV-1 falló: 2 líneas, 0 OT creadas'),
    );
  });

  it('usa el mismo número de sentencias con 5 o con 200 líneas (REQ-348)', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const conCinco = await emitirConLineas(5);
    const conDoscientas = await emitirConLineas(200);

    expect(conDoscientas).toHaveLength(conCinco.length);
    // OV, set_config, lectura FIFO, UPDATE de stock, movimientos, candado de
    // folio, contador, OT, líneas y tareas; la lectura final está simulada.
    expect(conDoscientas.length).toBeLessThanOrEqual(12);
  });

  it('informa cuántas OT creó en el registro', async () => {
    const registrar = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await emitirConLineas(200);

    expect(registrar).toHaveBeenCalledWith(
      expect.stringContaining('emitir OV-1: 200 líneas, 200 OT'),
    );
  });
});
