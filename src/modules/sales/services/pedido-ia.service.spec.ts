import { BadRequestException } from '@nestjs/common';
import fixture from '../ai/utils/__fixtures__/relectura-ov-940-943.json';
import { extractFiles } from '../ai/file-extractors';
import {
  ExtraccionTruncadaError,
  extraerPedido,
  type PedidoExtraido,
} from '../ai/openai-pedido.client';
import { groupOrigenCorreoToOrdenesTrabajo } from '../ai/utils/origen-correo-ordenes-trabajo';
import {
  fusionarPedidos,
  imponerOcDelDocumento,
  mapConLimite,
  nombreBaseAdjunto,
  PedidoIaService,
  separarContextoYDocumentos,
  unificarAlmacenesPorCodigo,
} from './pedido-ia.service';

jest.mock('../ai/file-extractors', () => ({ extractFiles: jest.fn() }));
jest.mock('../ai/openai-pedido.client', () => ({
  ...jest.requireActual('../ai/openai-pedido.client'),
  extraerPedido: jest.fn(),
}));

const extractFilesMock = extractFiles as jest.Mock;
const extraerPedidoMock = extraerPedido as jest.Mock;

type DocFixture = (typeof fixture.documentos)[number];
type Fila = Record<string, string | number>;

function pedidoDe(
  renglones: Array<Record<string, string | number>>,
): PedidoExtraido {
  return {
    fechaEntrega: '2026-10-30',
    centroConsumo: null,
    observaciones: null,
    ordenCompraHotel: null,
    nombreCliente: 'Hotel',
    lineas: renglones.map((r) => ({
      textoOriginal: String(r.Producto),
      numeroPedido: String(r['Numero pedido'] || '') || null,
      almacen: String(r.Almacen),
    })),
    origenCorreo: renglones,
    advertencia: null,
    archivosNoLegibles: [],
  } as unknown as PedidoExtraido;
}

/** Renglones sintéticos que reproducen, por almacén, la verdad del PDF (cantidad 1 × precio). */
function renglonesDe(doc: DocFixture, numeroPedido = ''): Array<Record<string, string | number>> {
  const filas: Array<Record<string, string | number>> = [];
  for (const [almacen, datos] of Object.entries(doc.almacenes)) {
    let restante = Math.round(datos.importe * 100);
    for (let i = 0; i < datos.renglones; i += 1) {
      const centavos =
        i === datos.renglones - 1
          ? restante
          : Math.floor(Math.round(datos.importe * 100) / datos.renglones);
      restante -= centavos;
      filas.push({
        Producto: `PRODUCTO ${filas.length}`,
        Almacen: almacen,
        Cantidad: 1,
        Precio: centavos / 100,
        'Numero pedido': numeroPedido,
      });
    }
  }
  return filas;
}

function textoPdf(doc: DocFixture, filas = 120): string {
  const relleno = Array.from(
    { length: filas },
    (_, i) => `${1000000 + i} PRODUCTO DE RELLENO ${i} ACOE ComedorEmplea 1 KG 10.00 MXN 10.00`,
  );
  return [
    'Facturar a:',
    `No. Pedido ${doc.oc}`,
    'ID Artículo Artículo Almacén Cantidad UM Precio',
    ...relleno,
    `Total pedido: MXN ${doc.totalDocumento.toFixed(2)}`,
  ].join('\n');
}

const cuerpo = {
  nombre: 'correo.eml — cuerpo',
  tipo: 'texto' as const,
  contenido: 'Buen día, confirmo la orden de compra.',
};
const archivoPdfCorto = (doc: DocFixture) => ({
  nombre: doc.nombre,
  tipo: 'texto' as const,
  contenido: textoPdf(doc, 20),
});
const archivoPdf = (doc: DocFixture, prefijo = '') => ({
  nombre: `${prefijo}${doc.nombre}`,
  tipo: 'texto' as const,
  contenido: textoPdf(doc),
});

function crearServicio(catalogo: unknown[] = [{ sku: '1', descripcion: 'AGUACATE', metadatosCatalogo: null }]) {
  const prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue(catalogo) };
  const config = { get: jest.fn().mockReturnValue('sk-test') };
  const locator = { assertSafeSchemaIdent: (s: string) => s };
  return new PedidoIaService(prisma as never, config as never, locator as never);
}

const ctx = { schemaName: 'emp_demo', codigoCuenta: '1YW43' } as never;

describe('separarContextoYDocumentos', () => {
  it('descarta el adjunto incrustado en el .eml que también se subió suelto', () => {
    const r = separarContextoYDocumentos([
      cuerpo,
      { nombre: 'correo.eml → A.pdf', tipo: 'texto', contenido: 'a' },
      { nombre: 'correo.eml → B.pdf', tipo: 'texto', contenido: 'b' },
      { nombre: 'A.pdf', tipo: 'texto', contenido: 'a' },
    ]);
    expect(r.contexto).toHaveLength(1);
    expect(r.documentos.map((d) => d.nombre)).toEqual([
      'correo.eml → B.pdf',
      'A.pdf',
    ]);
    expect(r.duplicados).toEqual(['correo.eml → A.pdf']);
  });

  it('las imágenes van con el primer documento si hay textos, o solas si no', () => {
    const imagen = { nombre: 'foto.jpg', tipo: 'imagen' as const, mime: 'image/jpeg', base64: 'x' };
    const conTexto = separarContextoYDocumentos([
      { nombre: 'A.pdf', tipo: 'texto', contenido: 'a' },
      imagen,
    ]);
    expect(conTexto.documentos).toHaveLength(1);
    expect(conTexto.documentos[0]!.archivos).toHaveLength(2);

    const soloImagen = separarContextoYDocumentos([imagen]);
    expect(soloImagen.documentos).toHaveLength(1);
    expect(soloImagen.documentos[0]!.esTexto).toBe(false);
  });

  it('separa los no legibles', () => {
    const r = separarContextoYDocumentos([
      { nombre: 'x.bin', tipo: 'no_legible', motivo: 'formato no soportado' },
    ]);
    expect(r.noLegibles).toHaveLength(1);
    expect(r.documentos).toHaveLength(0);
  });

  it('nombreBaseAdjunto compara sin la parte del .eml ni mayúsculas', () => {
    expect(nombreBaseAdjunto('correo.eml → Pedido_1.PDF')).toBe('pedido_1.pdf');
  });
});

describe('unificarAlmacenesPorCodigo', () => {
  const fila = (almacen: string): Fila => ({
    Producto: 'P',
    Almacen: almacen,
    Cantidad: 1,
    Precio: 1,
    'Numero pedido': '4502987081',
  });

  it('une «FYV AR87 Rest Medit 20» y «AR87 Rest Medit 20» al nombre más frecuente (el caso de las 26 OT)', () => {
    const pedido = pedidoDe([
      fila('FYV AR87 Rest Medit 20'),
      fila('FYV AR87 Rest Medit 20'),
      fila('AR87 Rest Medit 20'),
      fila('ARSE Room Service'),
    ]);
    unificarAlmacenesPorCodigo(pedido);
    expect(pedido.origenCorreo.map((r) => r.Almacen)).toEqual([
      'FYV AR87 Rest Medit 20',
      'FYV AR87 Rest Medit 20',
      'FYV AR87 Rest Medit 20',
      'ARSE Room Service',
    ]);
    expect(groupOrigenCorreoToOrdenesTrabajo(pedido.origenCorreo)).toHaveLength(2);
    expect(pedido.lineas.map((l) => l.almacen)[2]).toBe('FYV AR87 Rest Medit 20');
  });

  it('no toca almacenes de códigos distintos ni nombres sin código', () => {
    const pedido = pedidoDe([fila('ACOE ComedorEmplea'), fila('ABAR Bares'), fila('Cocina general')]);
    unificarAlmacenesPorCodigo(pedido);
    expect(pedido.origenCorreo.map((r) => r.Almacen)).toEqual([
      'ACOE ComedorEmplea',
      'ABAR Bares',
      'Cocina general',
    ]);
  });

  it('con un solo nombre por código no cambia nada', () => {
    const pedido = pedidoDe([fila('ACOE ComedorEmplea'), fila('ACOE ComedorEmplea')]);
    unificarAlmacenesPorCodigo(pedido);
    expect(pedido.origenCorreo.every((r) => r.Almacen === 'ACOE ComedorEmplea')).toBe(true);
  });
});

describe('mapConLimite', () => {
  it('respeta el límite de concurrencia y conserva el orden', async () => {
    let enVuelo = 0;
    let pico = 0;
    const r = await mapConLimite([1, 2, 3, 4, 5, 6], 2, async (n) => {
      enVuelo += 1;
      pico = Math.max(pico, enVuelo);
      await new Promise((ok) => setTimeout(ok, 5));
      enVuelo -= 1;
      return n * 10;
    });
    expect(r).toEqual([10, 20, 30, 40, 50, 60]);
    expect(pico).toBeLessThanOrEqual(2);
  });
});

describe('fusionarPedidos', () => {
  it('concatena renglones, reindexa y toma la cabecera del primero que la trae', () => {
    const a = pedidoDe([{ Producto: 'a', Almacen: 'X', Cantidad: 1, Precio: 1, 'Numero pedido': '1' }]);
    const b = pedidoDe([{ Producto: 'b', Almacen: 'Y', Cantidad: 1, Precio: 1, 'Numero pedido': '2' }]);
    a.nombreCliente = null;
    b.nombreCliente = 'Hotel B';
    a.advertencia = 'aviso A';
    const u = fusionarPedidos([a, b]);
    expect(u.origenCorreo).toHaveLength(2);
    expect(u.origenCorreo.map((r) => r._lineaIndex)).toEqual([0, 1]);
    expect(u.nombreCliente).toBe('Hotel B');
    expect(u.advertencia).toBe('aviso A');
  });
});

describe('imponerOcDelDocumento', () => {
  it('impone la única OC rotulada a todas las líneas', () => {
    const p = pedidoDe([{ Producto: 'a', Almacen: 'X', Cantidad: 1, Precio: 1, 'Numero pedido': '999' }]);
    const r = imponerOcDelDocumento(p, 'No. Pedido 4502987208\n...', 'AGUACATES_4502987208_UNICO.pdf');
    expect(r).toMatchObject({ oc: '4502987208', fuente: 'ambas', discrepa: false });
    expect(p.origenCorreo[0]!['Numero pedido']).toBe('4502987208');
    expect(p.ordenCompraHotel).toBe('4502987208');
  });

  it('no impone nada si el documento rotula varias OC (varios PO por almacén)', () => {
    const p = pedidoDe([{ Producto: 'a', Almacen: 'X', Cantidad: 1, Precio: 1, 'Numero pedido': '111111' }]);
    const r = imponerOcDelDocumento(p, 'No. Pedido 4502987208\nNo. Pedido 4502987081', 'x.pdf');
    expect(r.oc).toBeNull();
    expect(p.origenCorreo[0]!['Numero pedido']).toBe('111111');
  });

  it('avisa la discrepancia entre nombre y contenido y prefiere el contenido', () => {
    const p = pedidoDe([{ Producto: 'a', Almacen: 'X', Cantidad: 1, Precio: 1, 'Numero pedido': '' }]);
    const r = imponerOcDelDocumento(p, 'No. Pedido 4502987208', 'AGUACATES_4502987081_UNICO.pdf');
    expect(r).toMatchObject({ oc: '4502987208', fuente: 'contenido', discrepa: true });
  });
});

describe('PedidoIaService.leerArchivosParaCuenta — casos REQ-187', () => {
  const [doc940, doc081, doc208] = fixture.documentos;

  beforeEach(() => {
    extractFilesMock.mockReset();
    extraerPedidoMock.mockReset();
  });

  /** Simula al modelo: devuelve los renglones completos del documento que le llega. */
  function modeloPerfecto() {
    extraerPedidoMock.mockImplementation(async ({ archivosExtraidos }: { archivosExtraidos: Array<{ nombre: string }> }) => {
      const nombre = archivosExtraidos.map((a) => a.nombre).join('|');
      const doc = fixture.documentos.find((d) => nombre.includes(d.oc))!;
      return { pedido: pedidoDe(porteDe(renglonesDe(doc), nombre)), uso: null };
    });
  }

  /** Si la llamada es de un bloque «(parte i/n)», devuelve solo su porción de los renglones. */
  function porteDe(completos: Fila[], nombre: string): Fila[] {
    const parte = /\(parte (\d+)\/(\d+)\)/.exec(nombre);
    if (!parte) return completos;
    const i = Number(parte[1]) - 1;
    const n = Number(parte[2]);
    const tam = Math.ceil(completos.length / n);
    return completos.slice(i * tam, (i + 1) * tam);
  }

  it('OV-943: lee cada PDF aparte, sin duplicar el .eml, y da 24 OT / 198 renglones / 29,664.35', async () => {
    modeloPerfecto();
    extractFilesMock.mockResolvedValue([
      cuerpo,
      archivoPdf(doc081!, 'correo.eml → '),
      archivoPdf(doc208!, 'correo.eml → '),
      archivoPdf(doc081!),
      archivoPdf(doc208!),
    ]);

    const r = await crearServicio().leerArchivosParaCuenta({
      codigoCuenta: '1YW43',
      ctx,
      texto: '',
      archivos: [],
    });

    // Cada PDF va por bloques; ninguna llamada recibe el adjunto incrustado en el .eml.
    expect(extraerPedidoMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    const nombresLeidos = extraerPedidoMock.mock.calls.flatMap(
      ([entrada]: [{ archivosExtraidos: Array<{ nombre: string }> }]) =>
        entrada.archivosExtraidos.map((a) => a.nombre),
    );
    expect(nombresLeidos.some((n: string) => n.startsWith('correo.eml →'))).toBe(false);
    expect(r.documentos).toHaveLength(2);
    expect(r.documentos.map((d) => d.oc)).toEqual(['4502987081', '4502987208']);
    expect(r.documentos.every((d) => d.verificacion.cuadra === true)).toBe(true);
    expect(r.pedido.origenCorreo).toHaveLength(fixture.casos['OV-943'].renglones);
    expect(groupOrigenCorreoToOrdenesTrabajo(r.pedido.origenCorreo)).toHaveLength(
      fixture.casos['OV-943'].ots,
    );
    expect(
      r.documentos.reduce((s, d) => s + d.verificacion.importe, 0),
    ).toBeCloseTo(fixture.casos['OV-943'].importe, 2);
    expect(r.advertencias.map((a) => a.codigo)).toEqual([
      'ADJUNTO_DUPLICADO',
      'ADJUNTO_DUPLICADO',
    ]);
  });

  it('OV-940: un PDF da 20 OT / 134 renglones / 27,905.25', async () => {
    modeloPerfecto();
    extractFilesMock.mockResolvedValue([cuerpo, archivoPdf(doc940!)]);

    const r = await crearServicio().leerArchivosParaCuenta({
      codigoCuenta: '1YW43',
      ctx,
      texto: '',
      archivos: [],
    });

    expect(r.pedido.origenCorreo).toHaveLength(134);
    expect(groupOrigenCorreoToOrdenesTrabajo(r.pedido.origenCorreo)).toHaveLength(20);
    expect(r.documentos[0]!.verificacion).toMatchObject({ cuadra: true, totalDocumento: 27905.25 });
    expect(r.documentos[0]!.relecturaPorBloques).toBe(true);
  });

  it('un documento largo se lee por bloques en paralelo desde el inicio, nunca en una sola llamada', async () => {
    const completos = renglonesDe(doc081!);
    extraerPedidoMock.mockImplementation(async ({ archivosExtraidos }: { archivosExtraidos: Array<{ nombre: string }> }) => {
      const nombre = archivosExtraidos.map((a) => a.nombre).join('|');
      if (!/\(parte \d+\/\d+\)/.test(nombre)) throw new Error('no debía leerse completo');
      return { pedido: pedidoDe(porteDe(completos, nombre)), uso: null };
    });
    extractFilesMock.mockResolvedValue([cuerpo, archivoPdf(doc081!)]);

    const r = await crearServicio().leerArchivosParaCuenta({
      codigoCuenta: '1YW43',
      ctx,
      texto: '',
      archivos: [],
    });

    expect(extraerPedidoMock.mock.calls.length).toBeGreaterThan(1);
    expect(r.documentos[0]).toMatchObject({ relecturaPorBloques: true });
    expect(r.documentos[0]!.verificacion.cuadra).toBe(true);
    expect(r.pedido.origenCorreo).toHaveLength(116);
  });

  it('un documento corto se lee en una sola llamada', async () => {
    modeloPerfecto();
    extractFilesMock.mockResolvedValue([archivoPdfCorto(doc208!)]);

    const r = await crearServicio().leerArchivosParaCuenta({
      codigoCuenta: '1YW43',
      ctx,
      texto: '',
      archivos: [],
    });

    expect(extraerPedidoMock).toHaveBeenCalledTimes(1);
    expect(r.documentos[0]!.relecturaPorBloques).toBe(false);
    expect(r.pedido.origenCorreo).toHaveLength(82);
  });

  it('si por bloques el total no cuadra prueba la lectura completa y conserva la que sí cuadra', async () => {
    const completos = renglonesDe(doc081!);
    extraerPedidoMock.mockImplementation(async ({ archivosExtraidos }: { archivosExtraidos: Array<{ nombre: string }> }) => {
      const nombre = archivosExtraidos.map((a) => a.nombre).join('|');
      const esBloque = /\(parte \d+\/\d+\)/.test(nombre);
      // Los bloques se quedan cortos (solo 5 renglones cada uno); la lectura completa sí cuadra.
      return {
        pedido: pedidoDe(esBloque ? porteDe(completos, nombre).slice(0, 5) : completos),
        uso: null,
      };
    });
    extractFilesMock.mockResolvedValue([cuerpo, archivoPdf(doc081!)]);

    const r = await crearServicio().leerArchivosParaCuenta({
      codigoCuenta: '1YW43',
      ctx,
      texto: '',
      archivos: [],
    });

    expect(r.documentos[0]!.relecturaPorBloques).toBe(false);
    expect(r.documentos[0]!.verificacion.cuadra).toBe(true);
    expect(r.pedido.origenCorreo).toHaveLength(116);
    expect(r.advertencias.find((a) => a.codigo === 'TOTAL_NO_CUADRA')).toBeUndefined();
  });

  it('si la respuesta de un documento corto se corta por el tope de salida relee por bloques', async () => {
    const completos = renglonesDe(doc208!);
    extraerPedidoMock.mockImplementation(async ({ archivosExtraidos }: { archivosExtraidos: Array<{ nombre: string }> }) => {
      const nombre = archivosExtraidos.map((a) => a.nombre).join('|');
      if (!/\(parte \d+\/\d+\)/.test(nombre)) throw new ExtraccionTruncadaError(16384);
      return { pedido: pedidoDe(porteDe(completos, nombre)), uso: null };
    });
    extractFilesMock.mockResolvedValue([cuerpo, archivoPdfCorto(doc208!)]);

    const r = await crearServicio().leerArchivosParaCuenta({
      codigoCuenta: '1YW43',
      ctx,
      texto: '',
      archivos: [],
    });

    expect(r.documentos[0]!.relecturaPorBloques).toBe(true);
    expect(r.pedido.origenCorreo).toHaveLength(82);
  });

  it('avisa TOTAL_NO_CUADRA si ni releyendo por bloques cuadra', async () => {
    extraerPedidoMock.mockResolvedValue({
      pedido: pedidoDe(renglonesDe(doc208!).slice(0, 10)),
      uso: null,
    });
    extractFilesMock.mockResolvedValue([archivoPdf(doc208!)]);

    const r = await crearServicio().leerArchivosParaCuenta({
      codigoCuenta: '1YW43',
      ctx,
      texto: '',
      archivos: [],
    });

    expect(r.documentos[0]!.verificacion.cuadra).toBe(false);
    expect(r.advertencias.map((a) => a.codigo)).toContain('TOTAL_NO_CUADRA');
  });

  it('avisa OC_REPETIDA cuando dos archivos traen la misma OC (no los suma en silencio)', async () => {
    modeloPerfecto();
    extractFilesMock.mockResolvedValue([
      archivoPdf(doc081!),
      { ...archivoPdf(doc081!), nombre: 'COPIA_AGUACATES_4502987081.pdf' },
    ]);

    const r = await crearServicio().leerArchivosParaCuenta({
      codigoCuenta: '1YW43',
      ctx,
      texto: '',
      archivos: [],
    });

    expect(r.advertencias.map((a) => a.codigo)).toContain('OC_REPETIDA');
  });

  it('rechaza si la cuenta no tiene catálogo', async () => {
    await expect(
      crearServicio([]).leerArchivosParaCuenta({
        codigoCuenta: '1YW43',
        ctx,
        texto: '',
        archivos: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
