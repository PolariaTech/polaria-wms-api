import {
  bufferCuerpoGmail,
  decodificarCuerpoGmail,
  parsearMensajeGmail,
} from './gmail-correos.parse';

function enBase64Url(texto: string): string {
  return Buffer.from(texto, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

describe('parsearMensajeGmail (REQ-317)', () => {
  it('lee cabeceras, texto, html y adjuntos con attachmentId, sin bytes grandes', () => {
    const correo = parsearMensajeGmail({
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
            mimeType: 'multipart/alternative',
            parts: [
              {
                mimeType: 'text/plain',
                body: { data: enBase64Url('10 cajas') },
              },
              {
                mimeType: 'text/html',
                body: { data: enBase64Url('<p>10 cajas</p>') },
              },
            ],
          },
          {
            filename: 'pedido.pdf',
            mimeType: 'application/pdf',
            body: { attachmentId: 'ANGjd123', size: 48213 },
          },
        ],
      },
    });

    expect(correo).toMatchObject({
      asunto: 'Pedido XEL',
      de: 'compras@hotel.com',
      para: 'ventas@aguacates.com',
      fecha: 'Mon, 3 Nov 2026 08:27:51 -0500',
      texto: '10 cajas',
      html: '<p>10 cajas</p>',
    });
    expect(correo.adjuntos).toEqual([
      {
        nombre: 'pedido.pdf',
        mimeType: 'application/pdf',
        tamano: 48213,
        attachmentId: 'ANGjd123',
        datos: null,
      },
    ]);
  });

  it('un mensaje solo texto usa el cuerpo de la raíz', () => {
    const correo = parsearMensajeGmail({
      payload: {
        mimeType: 'text/plain',
        headers: [{ name: 'Subject', value: 'Hola' }],
        body: { data: enBase64Url('solo texto') },
      },
    });
    expect(correo.texto).toBe('solo texto');
    expect(correo.html).toBe('');
    expect(correo.adjuntos).toEqual([]);
  });

  it('un adjunto chico con data incrustada guarda los bytes para no volver a Gmail', () => {
    const correo = parsearMensajeGmail({
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
    });
    expect(correo.adjuntos[0]?.attachmentId).toBeNull();
    expect(correo.adjuntos[0]?.datos?.toString('utf8')).toBe('ok');
  });
});

describe('decodificarCuerpoGmail', () => {
  it('acepta base64url de Gmail', () => {
    expect(decodificarCuerpoGmail(enBase64Url('ping'))).toBe('ping');
    expect(bufferCuerpoGmail(enBase64Url('ping')).toString('utf8')).toBe('ping');
  });
});
