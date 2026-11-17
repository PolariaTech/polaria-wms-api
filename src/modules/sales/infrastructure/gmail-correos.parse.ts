export interface ParteGmail {
  filename?: string | null;
  mimeType?: string | null;
  headers?: Array<{ name?: string | null; value?: string | null }>;
  body?: {
    size?: number | null;
    data?: string | null;
    attachmentId?: string | null;
  };
  parts?: ParteGmail[] | null;
}

export interface MensajeGmail {
  payload?: ParteGmail | null;
}

export interface AdjuntoGmailMeta {
  nombre: string;
  mimeType: string;
  tamano: number;
  attachmentId: string | null;
  datos: Buffer | null;
}

export interface CorreoGmailLeido {
  asunto: string;
  de: string;
  para: string;
  fecha: string | null;
  texto: string;
  html: string;
  adjuntos: AdjuntoGmailMeta[];
}

export function decodificarCuerpoGmail(datos: string): string {
  return Buffer.from(datos.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
    'utf8',
  );
}

export function bufferCuerpoGmail(datos: string): Buffer {
  return Buffer.from(datos.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function valorEncabezado(parte: ParteGmail, nombre: string): string {
  const buscado = nombre.toLowerCase();
  for (const encabezado of parte.headers ?? []) {
    if ((encabezado.name ?? '').toLowerCase() === buscado) {
      return encabezado.value?.trim() ?? '';
    }
  }
  return '';
}

function recogerPartes(
  parte: ParteGmail | null | undefined,
  texto: { plano: string; html: string },
  adjuntos: AdjuntoGmailMeta[],
): void {
  if (!parte) return;
  const nombre = parte.filename?.trim() ?? '';
  const mime = parte.mimeType ?? 'application/octet-stream';
  const cuerpo = parte.body;
  if (nombre) {
    adjuntos.push({
      nombre,
      mimeType: mime,
      tamano: cuerpo?.size ?? (cuerpo?.data ? bufferCuerpoGmail(cuerpo.data).length : 0),
      attachmentId: cuerpo?.attachmentId?.trim() || null,
      datos: cuerpo?.data ? bufferCuerpoGmail(cuerpo.data) : null,
    });
  } else if (mime === 'text/plain' && cuerpo?.data && !texto.plano) {
    texto.plano = decodificarCuerpoGmail(cuerpo.data);
  } else if (mime === 'text/html' && cuerpo?.data && !texto.html) {
    texto.html = decodificarCuerpoGmail(cuerpo.data);
  }
  for (const hija of parte.parts ?? []) recogerPartes(hija, texto, adjuntos);
}

/** Arma el correo de lectura a partir del `payload` de `users.messages.get` (format=full). */
export function parsearMensajeGmail(mensaje: MensajeGmail): CorreoGmailLeido {
  const raiz = mensaje.payload ?? {};
  const texto = { plano: '', html: '' };
  const adjuntos: AdjuntoGmailMeta[] = [];
  recogerPartes(raiz, texto, adjuntos);
  return {
    asunto: valorEncabezado(raiz, 'Subject'),
    de: valorEncabezado(raiz, 'From'),
    para: valorEncabezado(raiz, 'To'),
    fecha: valorEncabezado(raiz, 'Date') || null,
    texto: texto.plano,
    html: texto.html,
    adjuntos,
  };
}
