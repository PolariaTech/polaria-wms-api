import { extractFiles } from './file-extractors';

/** JPEG de 1x1. file-type lo reconoce por la firma FF D8 FF. */
const JPEG_1X1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

function correoConFoto(disposicion: 'attachment' | 'inline'): Buffer {
  const limite = 'limite-req-261';
  const mensaje = [
    'From: cliente@example.com',
    'To: pedidos@aguacatesdepuebla.com',
    'Subject: Lista del dia',
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${limite}"`,
    '',
    `--${limite}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    'El pedido va en la foto.',
    `--${limite}`,
    'Content-Type: image/jpeg; name="lista.jpg"',
    `Content-Disposition: ${disposicion}; filename="lista.jpg"`,
    'Content-Transfer-Encoding: base64',
    '',
    JPEG_1X1.toString('base64'),
    `--${limite}--`,
    '',
  ].join('\r\n');
  return Buffer.from(mensaje, 'utf8');
}

describe('file-extractors (REQ-261)', () => {
  it('conserva la foto adjunta de un .eml para que el pedido se pueda leer', async () => {
    const extraidos = await extractFiles([
      {
        originalname: 'pedido.eml',
        mimetype: 'message/rfc822',
        buffer: correoConFoto('attachment'),
      },
    ]);

    const foto = extraidos.find((archivo) => archivo.tipo === 'imagen');
    expect(foto).toMatchObject({
      tipo: 'imagen',
      nombre: 'pedido.eml → lista.jpg',
      mime: 'image/jpeg',
    });
    if (foto?.tipo === 'imagen') {
      expect(foto.base64).toBe(JPEG_1X1.toString('base64'));
    }
  });

  it('sigue ignorando la imagen inline de la firma', async () => {
    const extraidos = await extractFiles([
      {
        originalname: 'pedido.eml',
        mimetype: 'message/rfc822',
        buffer: correoConFoto('inline'),
      },
    ]);

    expect(extraidos.some((archivo) => archivo.tipo === 'imagen')).toBe(false);
  });
});
