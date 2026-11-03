import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { N8nCorreosClient } from './n8n-correos.client';

const ENTRADA = { modo: 'descartados' as const, pagina: 1, tamano: 25 };

function cliente(valores: Record<string, string | undefined>) {
  const config = { get: (clave: string) => valores[clave] };
  return new N8nCorreosClient(config as unknown as ConfigService);
}

const CONFIGURADO = {
  N8N_CORREOS_URL: 'https://n8n.test/webhook/',
  N8N_CORREOS_API_KEY: 'llave-de-prueba',
};

function responder(cuerpo: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(cuerpo),
  } as unknown as Response;
}

describe('N8nCorreosClient (REQ-104)', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('manda la llave y los filtros al webhook de listar, sin barra doble', async () => {
    fetchMock.mockResolvedValue(responder({ total: 0, filas: [] }));

    await cliente(CONFIGURADO).listar({ ...ENTRADA, remitente: 'hotel' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://n8n.test/webhook/wms-correos-listar');
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe(
      'llave-de-prueba',
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      modo: 'descartados',
      soloDescartados: true,
      remitente: 'hotel',
    });
  });

  it('mapea las columnas del data table y descarta filas sin message_id', async () => {
    fetchMock.mockResolvedValue(
      responder({
        total: 120,
        filas: [
          {
            recibido_en: '2026-11-03T13:27:51.000Z',
            de: 'bss_system@birchstreet.net',
            para: 'ventas@x.com',
            asunto: 'Orden de compra',
            message_id: '1a1a198510cde156',
            hilo: '1a1a198510cde156',
            adjunto: 'PO_1.pdf',
            nuevo_pedido: false,
            motivo: 'cotización',
            id: 299,
            createdAt: '2026-11-03T13:28:42.556Z',
            updatedAt: '2026-11-03T13:29:10.000Z',
          },
          { asunto: 'sin id' },
          'basura',
          {
            message_id: 'abc123def',
            nuevo_pedido: null,
            motivo: '',
            adjunto: '',
          },
        ],
      }),
    );

    const resultado = await cliente(CONFIGURADO).listar(ENTRADA);

    expect(resultado.total).toBe(120);
    expect(resultado.filas).toHaveLength(2);
    expect(resultado.filas[0]).toEqual({
      recibidoEn: '2026-11-03T13:27:51.000Z',
      de: 'bss_system@birchstreet.net',
      para: 'ventas@x.com',
      asunto: 'Orden de compra',
      messageId: '1a1a198510cde156',
      hilo: '1a1a198510cde156',
      adjunto: 'PO_1.pdf',
      nuevoPedido: false,
      motivo: 'cotización',
      idRegistro: '299',
      registradoEn: '2026-11-03T13:28:42.556Z',
      actualizadoEn: '2026-11-03T13:29:10.000Z',
    });
    expect(resultado.filas[1]).toMatchObject({
      messageId: 'abc123def',
      nuevoPedido: null,
      motivo: null,
      adjunto: null,
      idRegistro: null,
      registradoEn: null,
      actualizadoEn: null,
    });
  });

  it('si n8n no manda total usa la cantidad de filas', async () => {
    fetchMock.mockResolvedValue(
      responder({ filas: [{ message_id: 'abc123def' }] }),
    );
    const resultado = await cliente(CONFIGURADO).listar(ENTRADA);
    expect(resultado.total).toBe(1);
  });

  it('obtener devuelve el correo y solo los adjuntos completos', async () => {
    fetchMock.mockResolvedValue(
      responder({
        asunto: 'Pedido',
        de: 'a@b.com',
        texto: 'hola',
        adjuntos: [
          { nombre: 'p.pdf', mimeType: 'application/pdf', base64: 'UERG' },
          { nombre: 'sin-datos.pdf' },
          { nombre: 'x.bin', base64: 'AAA=' },
        ],
      }),
    );

    const correo = await cliente(CONFIGURADO).obtener('1a1a198510cde156');

    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string),
    ).toEqual({
      messageId: '1a1a198510cde156',
    });
    expect(correo.asunto).toBe('Pedido');
    expect(correo.para).toBe('');
    expect(correo.adjuntos).toEqual([
      { nombre: 'p.pdf', mimeType: 'application/pdf', base64: 'UERG' },
      { nombre: 'x.bin', mimeType: 'application/octet-stream', base64: 'AAA=' },
    ]);
  });

  it.each([
    ['sin URL', { N8N_CORREOS_API_KEY: 'llave' }],
    ['sin llave', { N8N_CORREOS_URL: 'https://n8n.test/webhook' }],
    ['vacío', {}],
  ])(
    'responde 503 si los correos no están configurados (%s)',
    async (_n, valores) => {
      await expect(cliente(valores).listar(ENTRADA)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('responde 502 si n8n devuelve error', async () => {
    fetchMock.mockResolvedValue(responder({}, false, 500));
    const intento = cliente(CONFIGURADO).listar(ENTRADA);
    await expect(intento).rejects.toBeInstanceOf(BadGatewayException);
    await expect(intento).rejects.toMatchObject({
      response: { error: 'N8N_ERROR' },
    });
  });

  it('responde 502 si n8n no responde o se acaba el tiempo', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));
    await expect(
      cliente(CONFIGURADO).obtener('abc123def'),
    ).rejects.toMatchObject({
      response: { error: 'N8N_NO_RESPONDE' },
    });
  });

  it('responde 502 si la respuesta no es un objeto JSON', async () => {
    fetchMock.mockResolvedValue(responder(['no', 'objeto']));
    await expect(cliente(CONFIGURADO).listar(ENTRADA)).rejects.toMatchObject({
      response: { error: 'N8N_RESPUESTA_INVALIDA' },
    });
  });

  describe('caché del correo completo', () => {
    const correoDeN8n = {
      asunto: 'Pedido',
      adjuntos: [
        { nombre: 'a.pdf', mimeType: 'application/pdf', base64: 'UERG' },
      ],
    };

    it('lee el correo una sola vez aunque se pida varias veces', async () => {
      fetchMock.mockResolvedValue(responder(correoDeN8n));
      const unico = cliente(CONFIGURADO);

      await unico.obtener('abc123def');
      await unico.obtener('abc123def');
      const tercero = await unico.obtener('abc123def');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(tercero.adjuntos).toHaveLength(1);
    });

    it('dos peticiones a la vez por el mismo correo comparten una sola lectura', async () => {
      fetchMock.mockImplementation(
        () =>
          new Promise((resolver) =>
            setTimeout(() => resolver(responder(correoDeN8n)), 10),
          ),
      );
      const unico = cliente(CONFIGURADO);

      await Promise.all([
        unico.obtener('abc123def'),
        unico.obtener('abc123def'),
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('vuelve a leer el correo pasados cinco minutos', async () => {
      fetchMock.mockResolvedValue(responder(correoDeN8n));
      const unico = cliente(CONFIGURADO);
      const ahora = jest.spyOn(Date, 'now');
      try {
        ahora.mockReturnValue(1_000_000);
        await unico.obtener('abc123def');
        ahora.mockReturnValue(1_000_000 + 4 * 60_000);
        await unico.obtener('abc123def');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        ahora.mockReturnValue(1_000_000 + 5 * 60_000 + 1);
        await unico.obtener('abc123def');
        expect(fetchMock).toHaveBeenCalledTimes(2);
      } finally {
        ahora.mockRestore();
      }
    });

    it('guarda pocos correos: al pasar de cinco se descarta el más viejo', async () => {
      fetchMock.mockResolvedValue(responder(correoDeN8n));
      const unico = cliente(CONFIGURADO);
      for (let vuelta = 0; vuelta < 6; vuelta += 1) {
        await unico.obtener(`msg-${vuelta}-abcdef`);
      }
      expect(fetchMock).toHaveBeenCalledTimes(6);

      await unico.obtener('msg-5-abcdef'); // el último sigue guardado
      expect(fetchMock).toHaveBeenCalledTimes(6);
      await unico.obtener('msg-0-abcdef'); // el primero ya no
      expect(fetchMock).toHaveBeenCalledTimes(7);
    });

    it('un fallo de n8n no se queda guardado', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('n8n caído'))
        .mockResolvedValue(responder(correoDeN8n));
      const unico = cliente(CONFIGURADO);

      await expect(unico.obtener('abc123def')).rejects.toMatchObject({
        response: { error: 'N8N_NO_RESPONDE' },
      });
      await expect(unico.obtener('abc123def')).resolves.toBeDefined();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
