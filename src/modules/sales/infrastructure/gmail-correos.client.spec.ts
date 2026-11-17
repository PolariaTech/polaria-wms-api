import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GmailCorreosClient } from './gmail-correos.client';
import type { MensajeGmail } from './gmail-correos.parse';

function cliente(valores: Record<string, string | undefined> = CONFIGURADO) {
  const config = { get: (clave: string) => valores[clave] };
  return new GmailCorreosClient(config as unknown as ConfigService);
}

const CONFIGURADO = {
  GMAIL_CORREOS_CLIENT_ID: 'id-cliente',
  GMAIL_CORREOS_CLIENT_SECRET: 'secreto-cliente',
  GMAIL_CORREOS_REFRESH_TOKEN: 'refresh-de-prueba',
  GMAIL_CORREOS_USER: 'pedidos@example.com',
};

const MSG = '1a1a198510cde156';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const BASE = `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent('pedidos@example.com')}`;

function enBase64Url(texto: string): string {
  return Buffer.from(texto, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function mensajeSimple(): MensajeGmail {
  return {
    payload: {
      mimeType: 'multipart/mixed',
      headers: [
        { name: 'Subject', value: 'Pedido XEL' },
        { name: 'From', value: 'compras@hotel.com' },
        { name: 'To', value: 'ventas@aguacates.com' },
        { name: 'Date', value: 'Mon, 3 Nov 2026 08:27:51 -0500' },
      ],
      parts: [
        {
          mimeType: 'text/plain',
          body: { data: enBase64Url('10 cajas') },
        },
        {
          filename: 'pedido.pdf',
          mimeType: 'application/pdf',
          body: { attachmentId: 'ANGjd123', size: 3 },
        },
      ],
    },
  };
}

function responder(cuerpo: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(cuerpo),
  } as unknown as Response;
}

describe('GmailCorreosClient (REQ-317)', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
    fetchMock.mockImplementation((url: unknown) => {
      const destino = String(url);
      if (destino === TOKEN_URL) {
        return Promise.resolve(
          responder({ access_token: 'ya29.token', expires_in: 3600 }),
        );
      }
      if (destino.startsWith(`${BASE}/messages/${MSG}?format=full`)) {
        return Promise.resolve(responder(mensajeSimple()));
      }
      if (destino.includes('/attachments/ANGjd123')) {
        return Promise.resolve(responder({ data: enBase64Url('PDF') }));
      }
      return Promise.resolve(responder({}, false, 404));
    });
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('pide el token y el mensaje format=full, sin bajar el PDF', async () => {
    const correo = await cliente().obtener(MSG);

    expect(fetchMock.mock.calls.map((llamada) => String(llamada[0]))).toEqual([
      TOKEN_URL,
      `${BASE}/messages/${MSG}?format=full`,
    ]);
    const tokenInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(tokenInit.body)).toContain('refresh_token=refresh-de-prueba');
    expect(correo.asunto).toBe('Pedido XEL');
    expect(correo.texto).toBe('10 cajas');
    expect(correo.adjuntos[0]).toMatchObject({
      nombre: 'pedido.pdf',
      attachmentId: 'ANGjd123',
      datos: null,
    });
  });

  it('reusa el token y el mensaje en memoria', async () => {
    const unico = cliente();
    await unico.obtener(MSG);
    await unico.obtener(MSG);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('dos lecturas a la vez del mismo correo comparten un solo messages.get', async () => {
    fetchMock.mockImplementation(
      (url: unknown) =>
        new Promise((resolver) => {
          const destino = String(url);
          const cuerpo =
            destino === TOKEN_URL
              ? { access_token: 'ya29.token', expires_in: 3600 }
              : mensajeSimple();
          setTimeout(() => resolver(responder(cuerpo)), 10);
        }),
    );
    const unico = cliente();
    await Promise.all([unico.obtener(MSG), unico.obtener(MSG)]);
    const lecturas = fetchMock.mock.calls.filter((llamada) =>
      String(llamada[0]).includes('/messages/'),
    );
    expect(lecturas).toHaveLength(1);
  });

  it('baja un adjunto con attachments.get usando el attachmentId', async () => {
    const archivo = await cliente().descargarAdjunto(MSG, 0);
    expect(archivo.nombre).toBe('pedido.pdf');
    expect(archivo.buffer.toString('utf8')).toBe('PDF');
    expect(
      fetchMock.mock.calls.some((llamada) =>
        String(llamada[0]).includes(`/messages/${MSG}/attachments/ANGjd123`),
      ),
    ).toBe(true);
  });

  it('un adjunto chico incrustado no llama a attachments.get', async () => {
    fetchMock.mockImplementation((url: unknown) => {
      const destino = String(url);
      if (destino === TOKEN_URL) {
        return Promise.resolve(
          responder({ access_token: 'ya29.token', expires_in: 3600 }),
        );
      }
      return Promise.resolve(
        responder({
          payload: {
            headers: [],
            parts: [
              {
                filename: 'nota.txt',
                mimeType: 'text/plain',
                body: { data: enBase64Url('ok'), size: 2 },
              },
            ],
          },
        }),
      );
    });
    const archivo = await cliente().descargarAdjunto(MSG, 0);
    expect(archivo.buffer.toString('utf8')).toBe('ok');
    expect(
      fetchMock.mock.calls.some((llamada) =>
        String(llamada[0]).includes('/attachments/'),
      ),
    ).toBe(false);
  });

  it('responde 404 si no hay adjunto en esa posición', async () => {
    await expect(cliente().descargarAdjunto(MSG, 5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    ['sin id', { ...CONFIGURADO, GMAIL_CORREOS_CLIENT_ID: undefined }],
    ['sin secreto', { ...CONFIGURADO, GMAIL_CORREOS_CLIENT_SECRET: undefined }],
    ['sin refresh', { ...CONFIGURADO, GMAIL_CORREOS_REFRESH_TOKEN: undefined }],
  ])(
    'responde 503 si Gmail no está configurado (%s)',
    async (_n, valores) => {
      await expect(cliente(valores).obtener(MSG)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('responde 502 si Gmail no responde', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));
    await expect(cliente().obtener(MSG)).rejects.toMatchObject({
      response: { error: 'GMAIL_NO_RESPONDE' },
    });
  });

  it('responde 502 si Gmail devuelve error', async () => {
    fetchMock.mockResolvedValue(responder({}, false, 500));
    await expect(cliente().obtener(MSG)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
