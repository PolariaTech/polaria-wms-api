import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { N8nCorreosClient } from './n8n-correos.client';

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

  it('manda la llave y el messageId al webhook de obtener, sin barra doble', async () => {
    fetchMock.mockResolvedValue(responder({ asunto: 'Pedido' }));

    await cliente(CONFIGURADO).obtener('1a1a198510cde156');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://n8n.test/webhook/wms-correos-obtener');
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe(
      'llave-de-prueba',
    );
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
      await expect(
        cliente(valores).obtener('abc123def'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('responde 502 si n8n devuelve error', async () => {
    fetchMock.mockResolvedValue(responder({}, false, 500));
    const intento = cliente(CONFIGURADO).obtener('abc123def');
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
    await expect(
      cliente(CONFIGURADO).obtener('abc123def'),
    ).rejects.toMatchObject({
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
