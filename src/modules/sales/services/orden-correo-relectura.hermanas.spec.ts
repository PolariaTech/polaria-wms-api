import { ConflictException, Logger } from '@nestjs/common';
import { descargarAdjuntosOv } from '../ai/storage-ov-adjuntos';
import { OrdenCorreoRelecturaService } from './orden-correo-relectura.service';
import {
  body,
  ctx,
  ID_OV,
  orden,
  respuestaOrden,
} from './orden-correo-relectura.fixtures';

jest.mock('../ai/storage-ov-adjuntos', () => ({
  ...jest.requireActual('../ai/storage-ov-adjuntos'),
  descargarAdjuntosOv: jest.fn(),
}));
jest.mock('../ai/openai-reconciliacion.client', () => ({
  ...jest.requireActual('../ai/openai-reconciliacion.client'),
  reconciliarDiferencias: jest.fn(),
}));
const descargarMock = descargarAdjuntosOv as jest.Mock;

const fila = (oc: string, producto: string) => ({
  Producto: producto,
  Almacen: 'Cocina',
  Cantidad: 1,
  Precio: 10,
  'Numero pedido': oc,
  'Numero correo': 'correo-1',
  Horario: '2026-10-28 09:00:00',
});
const filasDe = (oc: string, n: number) =>
  Array.from({ length: n }, (_, i) => fila(oc, `${oc}-${i}`));

const propia = (extra: Record<string, unknown> = {}) =>
  orden({ ordenCompraHotel: 'A-1', origenCorreo: filasDe('A-1', 2), ...extra });
const hermana = (oc: string | null, codigo = 'OV-00001690') => ({
  codigo,
  ordenCompra: oc,
  origenCorreo: filasDe(oc ?? '', 2),
});
const lectura = (filas: unknown[]) => ({
  pedido: { origenCorreo: filas },
  textoOrigen: '',
  documentos: [],
  advertencias: [],
  catalogoProductos: 1,
  tokensTotal: 0,
  costoUSD: 0,
});

describe('OrdenCorreoRelecturaService — OV de un correo partido (REQ-313)', () => {
  let service: OrdenCorreoRelecturaService;
  let prisma: { $queryRawUnsafe: jest.Mock };
  let pedidoIa: { leerArchivosParaCuenta: jest.Mock };

  const conHermanas = (hermanas: unknown[], ov = propia()) =>
    prisma.$queryRawUnsafe.mockImplementation(respuestaOrden([ov], hermanas));

  beforeEach(() => {
    prisma = { $queryRawUnsafe: jest.fn() };
    pedidoIa = {
      leerArchivosParaCuenta: jest
        .fn()
        .mockResolvedValue(
          lectura([...filasDe('A-1', 3), ...filasDe('B-2', 4)]),
        ),
    };
    descargarMock.mockReset().mockResolvedValue({
      archivos: [
        {
          originalname: 'x.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('x'),
        },
      ],
      descargados: [{ nombre: 'x.pdf', path: '1yw43/b-x.pdf', bytes: 1 }],
      rechazados: [],
      excedeTope: false,
    });
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    service = new OrdenCorreoRelecturaService(
      prisma as never,
      { assertSafeSchemaIdent: (s: string) => s } as never,
      pedidoIa as never,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('con una hermana de otra OC, la propuesta solo trae la OC propia y avisa qué dejó fuera', async () => {
    conHermanas([hermana('B-2')]);

    const r = await service.proponer(ID_OV, body, ctx);

    expect(r.resumen).toMatchObject({ renglonesAntes: 2, renglonesDespues: 3 });
    expect(r.ots.every((ot) => ot.numeroPedido === 'A-1')).toBe(true);
    const aviso = r.advertencias.find((a) => a.codigo === 'OC_DE_OTRA_OV');
    expect(aviso?.detalle).toBe(
      'Se dejaron fuera 4 productos de la OC b-2: son de la OV-00001690, del mismo correo.',
    );
  });

  it('si tras filtrar no queda nada, conserva los renglones actuales', async () => {
    conHermanas([hermana('B-2')]);
    pedidoIa.leerArchivosParaCuenta.mockResolvedValue(
      lectura(filasDe('B-2', 4)),
    );

    const r = await service.proponer(ID_OV, body, ctx);

    expect(r.resumen).toMatchObject({ renglonesAntes: 2, renglonesDespues: 2 });
  });

  it('sin hermanas (OV-943) se amplía a las dos OC como siempre', async () => {
    conHermanas([]);

    const r = await service.proponer(ID_OV, body, ctx);

    expect(r.resumen.renglonesDespues).toBe(7);
    expect(r.advertencias.some((a) => a.codigo === 'OC_DE_OTRA_OV')).toBe(
      false,
    );
  });

  it.each([
    [
      'HERMANAS_SIN_OC',
      propia({ ordenCompraHotel: null, origenCorreo: [] }),
      hermana('B-2'),
    ],
    ['HERMANAS_MISMA_OC', propia(), hermana('A-1')],
  ])(
    '%s: lanza 409 con mensaje claro antes de bajar adjuntos o leer',
    async (codigo, ov, h) => {
      conHermanas([h], ov);

      const intento = service.proponer(ID_OV, body, ctx);

      await expect(intento).rejects.toBeInstanceOf(ConflictException);
      await expect(intento).rejects.toMatchObject({
        response: {
          error: codigo,
          message: expect.stringMatching(/^Esta OV /) as string,
        },
      });
      expect(descargarMock).not.toHaveBeenCalled();
      expect(pedidoIa.leerArchivosParaCuenta).not.toHaveBeenCalled();
    },
  );
});
