import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { N8nCorreosClient } from './n8n-correos.client';

const ENTRADA = { modo: 'descartados' as const, pagina: 1, tamano: 25 };

function cliente(valores: Record<string, string | undefined>) {
  const config = { get: (k: string) => valores[k] };
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

    const r = await cliente(CONFIGURADO).listar(ENTRADA);

    expect(r.total).toBe(120);
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]).toEqual({
      recibidoEn: '2026-11-03T13:27:51.000Z',
      de: 'bss_system@birchstreet.net',
      para: 'ventas@x.com',
      asunto: 'Orden de compra',
      messageId: '1a1a198510cde156',
      hilo: '1a1a198510cde156',
      adjunto: 'PO_1.pdf',
      nuevoPedido: false,
      motivo: 'cotización',
    });
    expect(r.filas[1]).toMatchObject({
      messageId: 'abc123def',
      nuevoPedido: null,
      motivo: null,
      adjunto: null,
    });
  });

  it('si n8n no manda total usa la cantidad de filas', async () => {
    fetchMock.mockResolvedValue(
      responder({ filas: [{ message_id: 'abc123def' }] }),
    );
    const r = await cliente(CONFIGURADO).listar(ENTRADA);
    expect(r.total).toBe(1);
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

    const c = await cliente(CONFIGURADO).obtener('1a1a198510cde156');

    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string),
    ).toEqual({
      messageId: '1a1a198510cde156',
    });
    expect(c.asunto).toBe('Pedido');
    expect(c.para).toBe('');
    expect(c.adjuntos).toEqual([
      { nombre: 'p.pdf', mimeType: 'application/pdf', base64: 'UERG' },
      { nombre: 'x.bin', mimeType: 'application/octet-stream', base64: 'AAA=' },
    ]);
  });

  it.each([
    ['sin URL', { N8N_CORREOS_API_KEY: 'k' }],
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
      response: { code: 'N8N_ERROR' },
    });
  });

  it('responde 502 si n8n no responde o se acaba el tiempo', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));
    await expect(
      cliente(CONFIGURADO).obtener('abc123def'),
    ).rejects.toMatchObject({
      response: { code: 'N8N_NO_RESPONDE' },
    });
  });

  it('responde 502 si la respuesta no es un objeto JSON', async () => {
    fetchMock.mockResolvedValue(responder(['no', 'objeto']));
    await expect(cliente(CONFIGURADO).listar(ENTRADA)).rejects.toMatchObject({
      response: { code: 'N8N_RESPUESTA_INVALIDA' },
    });
  });
});
