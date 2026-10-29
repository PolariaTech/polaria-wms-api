import {
  BadGatewayException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import {
  interpretarInstruccionChat,
  interpretarInstruccionConReglas,
} from '../ai/openai-pedido.client';
import { descargarAdjuntosOv } from '../ai/storage-ov-adjuntos';
import fixture from '../ai/utils/__fixtures__/relectura-ov-940-943.json';
import type { PropuestaCorreccionCorreoBodyDto } from '../dto/propuesta-correccion-correo.dto';
import { OrdenCorreoRelecturaService } from './orden-correo-relectura.service';
import type { DocumentoLeido } from './pedido-ia.service';

jest.mock('../ai/storage-ov-adjuntos', () => ({
  ...jest.requireActual('../ai/storage-ov-adjuntos'),
  descargarAdjuntosOv: jest.fn(),
}));
jest.mock('../ai/openai-pedido.client', () => ({
  ...jest.requireActual('../ai/openai-pedido.client'),
  interpretarInstruccionChat: jest.fn(),
}));
const descargarMock = descargarAdjuntosOv as jest.Mock;
const interpretarMock = interpretarInstruccionChat as jest.Mock;

const ID_OV = '550e8400-e29b-41d4-a716-446655440000';
const ID_BODEGA = '660e8400-e29b-41d4-a716-446655440001';
const REQUEST_ID = '770e8400-e29b-41d4-a716-446655440002';

const ctx: TenantContext = {
  idUsuario: 'user-1',
  idRol: WmsRol.operador_cuenta,
  nivelRol: RolNivel.cuenta,
  codigoEmpresa: 'EMP001',
  codigoCuenta: '1YW43',
  codigosCuentaEmpresa: ['1YW43'],
  idBodegas: [],
  schemaName: 'emp_demo',
};

const body: PropuestaCorreccionCorreoBodyDto = { requestId: REQUEST_ID };

type DocFixture = (typeof fixture.documentos)[number];
type Fila = Record<string, string | number>;

function renglonesDe(doc: DocFixture): Fila[] {
  const filas: Fila[] = [];
  for (const [almacen, datos] of Object.entries(doc.almacenes)) {
    for (let i = 0; i < datos.renglones; i += 1) {
      filas.push({
        Producto: `PRODUCTO ${filas.length}`,
        Almacen: almacen,
        Cantidad: 1,
        Precio: datos.importe / datos.renglones,
        'Numero pedido': doc.oc,
        'Numero correo': 'correo-1',
        Horario: '2026-10-28 09:00:00',
      });
    }
  }
  return filas;
}

function documentoLeido(doc: DocFixture, cuadra: boolean | null = true): DocumentoLeido {
  return {
    nombre: doc.nombre,
    oc: doc.oc,
    ocFuente: 'ambas',
    renglones: doc.renglones,
    verificacion: {
      totalDocumento: doc.totalDocumento,
      importe: cuadra === false ? 1 : doc.totalDocumento,
      diferencia: cuadra === false ? 1 - doc.totalDocumento : 0,
      cuadra,
    },
    relecturaPorBloques: false,
  };
}

const [doc940, doc081, doc208] = fixture.documentos;

/** OV-943 tal como quedó mal leída: solo el primer PDF y apenas 60 de sus renglones (6 almacenes). */
const origenIncompleto = renglonesDe(doc081!).slice(0, 60);

function orden(parcial: Record<string, unknown> = {}) {
  return {
    idOrdenVenta: ID_OV,
    codigoCuenta: '1YW43',
    idBodega: ID_BODEGA,
    estado: 'por_confirmar',
    origenCorreo: origenIncompleto,
    origenArchivos: JSON.stringify([
      { nombre: 'correo.eml', path: '1yw43/a-correo.eml', mime: 'message/rfc822', bytes: 10 },
      { nombre: doc081!.nombre, path: `1yw43/b-${doc081!.nombre}`, mime: 'application/pdf', bytes: 10 },
      { nombre: doc208!.nombre, path: `1yw43/c-${doc208!.nombre}`, mime: 'application/pdf', bytes: 10 },
    ]),
    ...parcial,
  };
}

describe('OrdenCorreoRelecturaService', () => {
  let service: OrdenCorreoRelecturaService;
  let prisma: { $queryRawUnsafe: jest.Mock };
  let pedidoIa: { leerArchivosParaCuenta: jest.Mock };

  function lectura943(cuadra: boolean | null = true, advertencias: unknown[] = []) {
    return {
      pedido: { origenCorreo: [...renglonesDe(doc081!), ...renglonesDe(doc208!)] },
      textoOrigen: '',
      documentos: [documentoLeido(doc081!, cuadra), documentoLeido(doc208!, cuadra)],
      advertencias,
      catalogoProductos: 197,
      tokensTotal: 1000,
      costoUSD: 0.01,
    };
  }

  beforeEach(() => {
    prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([orden()]) };
    pedidoIa = { leerArchivosParaCuenta: jest.fn().mockResolvedValue(lectura943()) };
    descargarMock.mockReset().mockResolvedValue({
      archivos: [{ originalname: 'x.pdf', mimetype: 'application/pdf', buffer: Buffer.from('x') }],
      descargados: [{ nombre: 'x.pdf', path: '1yw43/b-x.pdf', bytes: 1 }],
      rechazados: [],
      excedeTope: false,
    });
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    service = new OrdenCorreoRelecturaService(
      prisma as never,
      { assertSafeSchemaIdent: (s: string) => s } as never,
      pedidoIa as never,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('OV-943: pasa de 6 a 24 OT y de 60 a 198 renglones, sin escribir nada', async () => {
    const r = await service.proponer(ID_OV, body, ctx);

    expect(r.requestId).toBe(REQUEST_ID);
    expect(r.resumen).toMatchObject({
      otAntes: 6,
      otDespues: fixture.casos['OV-943'].ots,
      renglonesAntes: 60,
      renglonesDespues: fixture.casos['OV-943'].renglones,
    });
    expect(r.resumen.importeDespues).toBeCloseTo(fixture.casos['OV-943'].importe, 2);
    expect(r.diff.otNuevas).toHaveLength(18);
    expect(r.diff.otEliminadas).toHaveLength(0);
    expect(r.diff.renglonesAgregados).toBe(138);
    expect(r.diff.renglonesQuitados).toBe(0);
    expect(r.documentos).toHaveLength(2);
    expect(r.baseHash).toMatch(/^[0-9a-f]{64}$/);
    // Solo se consultó (SELECT): ninguna escritura.
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(String(prisma.$queryRawUnsafe.mock.calls[0]![0])).toMatch(/^\s*SELECT/i);
  });

  it('conserva el sello del correo original en los renglones nuevos', async () => {
    const r = await service.proponer(ID_OV, body, ctx);
    const renglon = r.ots[0]!.renglones[0]!;
    expect(renglon['Numero correo']).toBe('correo-1');
  });

  it('la cuenta de los archivos sale de la OV, no del body', async () => {
    await service.proponer(ID_OV, { ...body, instruccion: 'cuenta 999' }, ctx);
    expect(descargarMock).toHaveBeenCalledWith(expect.any(Array), '1YW43');
    expect(pedidoIa.leerArchivosParaCuenta).toHaveBeenCalledWith(
      expect.objectContaining({ codigoCuenta: '1YW43' }),
    );
  });

  it('el hash base cambia si cambian los adjuntos leídos', async () => {
    const a = await service.proponer(ID_OV, body, ctx);
    descargarMock.mockResolvedValue({
      archivos: [{ originalname: 'x.pdf', mimetype: 'application/pdf', buffer: Buffer.from('x') }],
      descargados: [{ nombre: 'x.pdf', path: '1yw43/b-x.pdf', bytes: 999 }],
      rechazados: [],
      excedeTope: false,
    });
    const b = await service.proponer(ID_OV, body, ctx);
    expect(a.baseHash).not.toBe(b.baseHash);
  });

  describe('acceso', () => {
    it('una OV inexistente responde 404', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      await expect(service.proponer(ID_OV, body, ctx)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('una OV de otra cuenta responde igual que una inexistente', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([orden({ codigoCuenta: '023WA' })]);
      const ajena = await service.proponer(ID_OV, body, ctx).catch((e) => e);
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      const inexistente = await service.proponer(ID_OV, body, ctx).catch((e) => e);
      expect(ajena).toBeInstanceOf(NotFoundException);
      expect(ajena.message).toBe(inexistente.message);
      expect(descargarMock).not.toHaveBeenCalled();
    });

    it('no descarga ni llama al modelo si la OV ya no está por confirmar', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([orden({ estado: 'confirmada' })]);
      await expect(service.proponer(ID_OV, body, ctx)).rejects.toBeInstanceOf(ConflictException);
      expect(descargarMock).not.toHaveBeenCalled();
      expect(pedidoIa.leerArchivosParaCuenta).not.toHaveBeenCalled();
    });

    it('un error de base de datos no filtra el detalle', async () => {
      prisma.$queryRawUnsafe.mockRejectedValue(new Error('password authentication failed'));
      const error = await service.proponer(ID_OV, body, ctx).catch((e) => e);
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(JSON.stringify(error.getResponse())).not.toContain('password');
    });
  });

  describe('archivos originales', () => {
    it('SIN_ADJUNTOS_ORIGINALES si origen_archivos es texto libre de una OV vieja', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([orden({ origenArchivos: 'correo.eml, pedido.pdf' })]);
      const error = await service.proponer(ID_OV, body, ctx).catch((e) => e);
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(error.getResponse()).toMatchObject({ error: 'SIN_ADJUNTOS_ORIGINALES' });
    });

    it('ADJUNTOS_NO_DISPONIBLES si no se pudo descargar ninguno', async () => {
      descargarMock.mockResolvedValue({
        archivos: [],
        descargados: [],
        rechazados: [{ nombre: 'a.pdf', motivo: 'PATH_FUERA_DE_CUENTA' }],
        excedeTope: false,
      });
      const error = await service.proponer(ID_OV, body, ctx).catch((e) => e);
      expect(error.getResponse()).toMatchObject({ error: 'ADJUNTOS_NO_DISPONIBLES' });
      expect(pedidoIa.leerArchivosParaCuenta).not.toHaveBeenCalled();
    });

    it('reporta como advertencia los adjuntos rechazados', async () => {
      descargarMock.mockResolvedValue({
        archivos: [{ originalname: 'x.pdf', mimetype: 'application/pdf', buffer: Buffer.from('x') }],
        descargados: [{ nombre: 'x.pdf', path: '1yw43/b-x.pdf', bytes: 1 }],
        rechazados: [{ nombre: 'otra.pdf', motivo: 'SUPERA_TOPE_BYTES' }],
        excedeTope: true,
      });
      const r = await service.proponer(ID_OV, body, ctx);
      expect(r.advertencias.map((a) => a.codigo)).toEqual(
        expect.arrayContaining(['ADJUNTOS_EXCEDEN_TOPE', 'ADJUNTO_RECHAZADO']),
      );
    });
  });

  describe('verificación contra el documento', () => {
    it('RELECTURA_NO_CUADRA: no ofrece propuesta si un total no coincide', async () => {
      pedidoIa.leerArchivosParaCuenta.mockResolvedValue(lectura943(false));
      const error = await service.proponer(ID_OV, body, ctx).catch((e) => e);
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(error.getResponse()).toMatchObject({
        error: 'RELECTURA_NO_CUADRA',
        documentos: expect.arrayContaining([
          expect.objectContaining({ nombre: doc081!.nombre }),
        ]),
      });
    });

    it('OC_REPETIDA: 409 cuando dos archivos traen la misma OC', async () => {
      pedidoIa.leerArchivosParaCuenta.mockResolvedValue(
        lectura943(true, [
          { codigo: 'OC_REPETIDA', documento: doc208!.nombre, detalle: 'misma OC' },
        ]),
      );
      const error = await service.proponer(ID_OV, body, ctx).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ error: 'OC_REPETIDA' });
    });

    it('un documento sin total declarado no bloquea: queda como advertencia', async () => {
      pedidoIa.leerArchivosParaCuenta.mockResolvedValue(
        lectura943(null, [
          { codigo: 'SIN_TOTAL_DOCUMENTO', documento: doc081!.nombre, detalle: 'no verificable' },
        ]),
      );
      const r = await service.proponer(ID_OV, body, ctx);
      expect(r.advertencias.map((a) => a.codigo)).toContain('SIN_TOTAL_DOCUMENTO');
      expect(r.documentos[0]!.verificacion.cuadra).toBeNull();
    });
  });

  it('OV-940: un PDF da 20 OT y 134 renglones', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([orden({ origenCorreo: renglonesDe(doc940!).slice(0, 72) })]);
    pedidoIa.leerArchivosParaCuenta.mockResolvedValue({
      ...lectura943(),
      pedido: { origenCorreo: renglonesDe(doc940!) },
      documentos: [documentoLeido(doc940!)],
    });
    const r = await service.proponer(ID_OV, body, ctx);
    expect(r.resumen).toMatchObject({
      otAntes: 11,
      otDespues: fixture.casos['OV-940'].ots,
      renglonesAntes: 72,
      renglonesDespues: fixture.casos['OV-940'].renglones,
    });
  });

  it('un fallo del proveedor de IA responde 502 sin filtrar el detalle', async () => {
    pedidoIa.leerArchivosParaCuenta.mockRejectedValue(new Error('401 Incorrect API key sk-secret'));
    const error = await service.proponer(ID_OV, body, ctx).catch((e) => e);
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(JSON.stringify(error.getResponse())).not.toContain('sk-secret');
  });

  it('los logs llevan solo metadatos', async () => {
    const log = jest.spyOn(Logger.prototype, 'log');
    await service.proponer(ID_OV, { ...body, instruccion: 'texto secreto del usuario' }, ctx);
    const linea = String(log.mock.calls.at(-1)![0]);
    expect(linea).toContain('correccion_correo_ot');
    expect(linea).not.toContain('texto secreto');
    expect(linea).not.toContain('PRODUCTO');
  });
});

describe('OrdenCorreoRelecturaService — trabajo asíncrono, interpretación y expectativas', () => {
  let service: OrdenCorreoRelecturaService;
  let prisma: { $queryRawUnsafe: jest.Mock };
  let pedidoIa: { leerArchivosParaCuenta: jest.Mock };

  const lecturaDe = (docs: DocFixture[]) => ({
    pedido: { origenCorreo: docs.flatMap((d) => renglonesDe(d)) },
    textoOrigen: '',
    documentos: docs.map((d) => documentoLeido(d)),
    advertencias: [],
    catalogoProductos: 197,
    tokensTotal: 1000,
    costoUSD: 0.01,
  });

  const diferida = <T,>() => {
    let resolver!: (valor: T) => void;
    let rechazar!: (error: unknown) => void;
    const promesa = new Promise<T>((res, rej) => {
      resolver = res;
      rechazar = rej;
    });
    return { promesa, resolver, rechazar };
  };

  /** Consulta hasta que el trabajo deje de estar «procesando». */
  async function esperar(jobId: string, usuario: TenantContext = ctx) {
    for (let i = 0; i < 50; i += 1) {
      const r = service.consultar(ID_OV, jobId, usuario);
      if (r.estado !== 'procesando') return r;
      await new Promise((ok) => setImmediate(ok));
    }
    throw new Error('el trabajo no terminó');
  }

  const textoAndres940 =
    'Mateo, este pedido debe ser reorganizado en 21 OT, y debes verificar que todas las líneas de producto se incluyan correctamente para que el total de la factura sea 27,905.25';
  const textoAndres943 =
    'Partir este pedido en 12 OT para la OCC 4502987081, y en otras 12 para la OCC 4502987208, para un total de 24 OT de todo el pedido.';

  beforeEach(() => {
    prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([orden()]) };
    pedidoIa = { leerArchivosParaCuenta: jest.fn().mockResolvedValue(lecturaDe([doc081!, doc208!])) };
    descargarMock.mockReset().mockResolvedValue({
      archivos: [{ originalname: 'x.pdf', mimetype: 'application/pdf', buffer: Buffer.from('x') }],
      descargados: [{ nombre: 'x.pdf', path: '1yw43/b-x.pdf', bytes: 1 }],
      rechazados: [],
      excedeTope: false,
    });
    interpretarMock.mockReset();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    service = new OrdenCorreoRelecturaService(
      prisma as never,
      { assertSafeSchemaIdent: (s: string) => s } as never,
      pedidoIa as never,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  describe('iniciar / consultar', () => {
    it('iniciar responde al instante con un jobId, sin esperar la lectura', async () => {
      const lectura = diferida<ReturnType<typeof lecturaDe>>();
      pedidoIa.leerArchivosParaCuenta.mockReturnValue(lectura.promesa);

      const r = await service.iniciar(ID_OV, body, ctx);

      expect(r).toMatchObject({ requestId: REQUEST_ID, estado: 'procesando' });
      expect(r.jobId).toMatch(/^[0-9a-f-]{36}$/);
      expect(service.consultar(ID_OV, r.jobId, ctx)).toEqual({ estado: 'procesando' });

      lectura.resolver(lecturaDe([doc081!, doc208!]));
      const listo = await esperar(r.jobId);
      expect(listo.estado).toBe('listo');
      expect(listo.propuesta!.resumen.otDespues).toBe(fixture.casos['OV-943'].ots);
    });

    it('un segundo inicio mientras corre devuelve el mismo trabajo y no vuelve a leer', async () => {
      const lectura = diferida<ReturnType<typeof lecturaDe>>();
      pedidoIa.leerArchivosParaCuenta.mockReturnValue(lectura.promesa);

      const a = await service.iniciar(ID_OV, body, ctx);
      const b = await service.iniciar(ID_OV, { requestId: '880e8400-e29b-41d4-a716-446655440009' }, ctx);

      expect(b.jobId).toBe(a.jobId);
      expect(pedidoIa.leerArchivosParaCuenta).toHaveBeenCalledTimes(1);
      lectura.resolver(lecturaDe([doc081!]));
      await esperar(a.jobId);
    });

    it('valida lo barato al instante y no crea trabajo: estado, archivos y OV ajena', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([orden({ estado: 'confirmada' })]);
      await expect(service.iniciar(ID_OV, body, ctx)).rejects.toBeInstanceOf(ConflictException);

      prisma.$queryRawUnsafe.mockResolvedValue([orden({ origenArchivos: null })]);
      const sinArchivos = await service.iniciar(ID_OV, body, ctx).catch((e) => e);
      expect(sinArchivos.getResponse()).toMatchObject({ error: 'SIN_ADJUNTOS_ORIGINALES' });

      prisma.$queryRawUnsafe.mockResolvedValue([orden({ codigoCuenta: '023WA' })]);
      await expect(service.iniciar(ID_OV, body, ctx)).rejects.toBeInstanceOf(NotFoundException);

      expect(pedidoIa.leerArchivosParaCuenta).not.toHaveBeenCalled();
    });

    it('el trabajo solo lo ve quien lo inició, para esa OV', async () => {
      const { jobId } = await service.iniciar(ID_OV, body, ctx);
      await esperar(jobId);

      const otroUsuario: TenantContext = { ...ctx, idUsuario: 'user-2' };
      expect(() => service.consultar(ID_OV, jobId, otroUsuario)).toThrow(NotFoundException);
      expect(() => service.consultar('otra-ov', jobId, ctx)).toThrow(NotFoundException);
      expect(() => service.consultar(ID_OV, jobId, { ...ctx, schemaName: 'emp_otro' })).toThrow(
        NotFoundException,
      );
    });

    it('un trabajo desconocido (expirado o servidor reiniciado) responde TRABAJO_NO_ENCONTRADO', () => {
      let error: unknown;
      try {
        service.consultar(ID_OV, '990e8400-e29b-41d4-a716-446655440010', ctx);
      } catch (e) {
        error = e;
      }
      expect((error as NotFoundException).getResponse()).toMatchObject({
        error: 'TRABAJO_NO_ENCONTRADO',
      });
    });

    it('un error de negocio sale con su mismo código, una sola vez', async () => {
      pedidoIa.leerArchivosParaCuenta.mockResolvedValue({
        ...lecturaDe([doc081!]),
        documentos: [documentoLeido(doc081!, false)],
      });
      const { jobId } = await service.iniciar(ID_OV, body, ctx);

      const error = await esperar(jobId).catch((e) => e);
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(error.getResponse()).toMatchObject({ error: 'RELECTURA_NO_CUADRA' });
      // Ya se entregó: no se vuelve a servir.
      expect(() => service.consultar(ID_OV, jobId, ctx)).toThrow(NotFoundException);
    });

    it('un fallo inesperado sale como 502 sin filtrar el detalle', async () => {
      pedidoIa.leerArchivosParaCuenta.mockRejectedValue(new Error('sk-secret exploded'));
      const { jobId } = await service.iniciar(ID_OV, body, ctx);

      const error = await esperar(jobId).catch((e) => e);
      expect(error).toBeInstanceOf(BadGatewayException);
      expect(JSON.stringify(error.getResponse())).not.toContain('sk-secret');
    });
  });

  describe('expectativas del usuario', () => {
    beforeEach(() => {
      prisma.$queryRawUnsafe.mockResolvedValue([
        orden({ origenCorreo: renglonesDe(doc940!).slice(0, 72) }),
      ]);
      pedidoIa.leerArchivosParaCuenta.mockResolvedValue(lecturaDe([doc940!]));
    });

    it('compara las OT y el total esperados con los documentos y avisa la diferencia', async () => {
      const r = await service.proponer(
        ID_OV,
        { ...body, expectativas: { totalOt: 21, importeTotal: 27905.25 } },
        ctx,
      );

      expect(r.expectativas).toMatchObject({
        totalOtPedido: 21,
        totalOtResultado: 20,
        coincideTotalOt: false,
        importeTotalPedido: 27905.25,
        coincideImporte: true,
      });
      const aviso = r.advertencias.find((a) => a.codigo === 'EXPECTATIVA_OT_DISTINTA');
      expect(aviso?.detalle).toContain('21');
      expect(aviso?.detalle).toContain('20');
      expect(r.advertencias.some((a) => a.codigo === 'EXPECTATIVA_IMPORTE_DISTINTO')).toBe(false);
    });

    it('avisa si el total esperado no coincide con lo que suman los documentos', async () => {
      const r = await service.proponer(ID_OV, { ...body, expectativas: { importeTotal: 30000 } }, ctx);
      expect(r.expectativas).toMatchObject({ coincideImporte: false, coincideTotalOt: null });
      expect(r.advertencias.some((a) => a.codigo === 'EXPECTATIVA_IMPORTE_DISTINTO')).toBe(true);
    });

    it('sin expectativas no agrega nada', async () => {
      const r = await service.proponer(ID_OV, body, ctx);
      expect(r.expectativas).toBeUndefined();
    });
  });

  describe('interpretar la instrucción del chat', () => {
    it('devuelve la función elegida por el modelo y lo que el usuario espera', async () => {
      interpretarMock.mockResolvedValue({
        intencion: 'releer_documentos',
        motivo: 'Habla del total de la factura.',
        totalOt: 21,
        importeTotal: 27905.25,
        uso: null,
      });

      const r = await service.interpretar(ID_OV, { requestId: REQUEST_ID, instruccion: textoAndres940 }, ctx);

      expect(r).toEqual({
        requestId: REQUEST_ID,
        intencion: 'releer_documentos',
        motivo: 'Habla del total de la factura.',
        expectativas: { totalOt: 21, importeTotal: 27905.25 },
        porReglas: false,
      });
      expect(interpretarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          instruccion: textoAndres940,
          otActuales: 6,
          renglonesActuales: 60,
          pedidosDistintos: 1,
          tieneArchivosOriginales: true,
        }),
      );
    });

    it('si el modelo falla, el respaldo por reglas decide: texto de Andrés sobre OV-940', async () => {
      interpretarMock.mockRejectedValue(new Error('proveedor caído'));
      const r = await service.interpretar(ID_OV, { requestId: REQUEST_ID, instruccion: textoAndres940 }, ctx);
      expect(r).toMatchObject({
        intencion: 'releer_documentos',
        porReglas: true,
        expectativas: { totalOt: 21, importeTotal: 27905.25 },
      });
    });

    it('respaldo por reglas con el texto de Andrés sobre OV-943: 24 OT y sin confundirlo con un importe', async () => {
      interpretarMock.mockRejectedValue(new Error('proveedor caído'));
      const r = await service.interpretar(ID_OV, { requestId: REQUEST_ID, instruccion: textoAndres943 }, ctx);
      expect(r.intencion).toBe('releer_documentos');
      expect(r.expectativas).toEqual({ totalOt: 24 });
    });

    it('sin archivos originales nunca propone releer', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([orden({ origenArchivos: null })]);
      interpretarMock.mockRejectedValue(new Error('proveedor caído'));
      const r = await service.interpretar(ID_OV, { requestId: REQUEST_ID, instruccion: textoAndres940 }, ctx);
      expect(r.intencion).toBe('reorganizar');
      expect(interpretarMock).toHaveBeenCalledWith(
        expect.objectContaining({ tieneArchivosOriginales: false }),
      );
    });

    it('una OV que ya no está por confirmar responde 409 sin llamar al modelo', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([orden({ estado: 'confirmada' })]);
      await expect(
        service.interpretar(ID_OV, { requestId: REQUEST_ID, instruccion: 'hola' }, ctx),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(interpretarMock).not.toHaveBeenCalled();
    });

    it('no registra el texto de la instrucción', async () => {
      interpretarMock.mockResolvedValue({
        intencion: 'reorganizar',
        motivo: '',
        totalOt: null,
        importeTotal: null,
        uso: null,
      });
      const log = jest.spyOn(Logger.prototype, 'log');
      await service.interpretar(ID_OV, { requestId: REQUEST_ID, instruccion: 'texto secreto del usuario' }, ctx);
      expect(String(log.mock.calls.at(-1)![0])).not.toContain('texto secreto');
    });
  });

  describe('interpretarInstruccionConReglas', () => {
    const base = {
      otActuales: 6,
      renglonesActuales: 60,
      importeActual: 100,
      pedidosDistintos: 1,
      tieneArchivosOriginales: true,
    };

    it('mover renglones concretos sigue siendo reorganizar (caso Monarca)', () => {
      const r = interpretarInstruccionConReglas({
        ...base,
        instruccion: 'Puedes partir la tarea MDC Monarca en dos diferentes. Una es MDC Monarca y la otra es Monarca.',
      });
      expect(r.intencion).toBe('reorganizar');
    });

    it('hablar de totales, facturas, PDF o correo es releer', () => {
      for (const t of ['no cuadra con la factura', 'revisa el PDF', 'relee el correo', 'verifica los totales']) {
        expect(interpretarInstruccionConReglas({ ...base, instruccion: t }).intencion).toBe(
          'releer_documentos',
        );
      }
    });
  });
});
