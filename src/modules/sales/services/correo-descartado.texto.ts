import { HttpException } from '@nestjs/common';
import type {
  CorreoN8nAdjunto,
  CorreoN8nCompleto,
} from '../infrastructure/n8n-correos.client';

const MAX_TEXTO = 20_000;

export function aArchivo(adjunto: CorreoN8nAdjunto): Express.Multer.File {
  const buffer = Buffer.from(adjunto.base64, 'base64');
  return {
    fieldname: 'archivos',
    originalname: adjunto.nombre,
    encoding: '7bit',
    mimetype: adjunto.mimeType,
    size: buffer.length,
    buffer,
  } as Express.Multer.File;
}

function sinHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function armarTexto(correo: CorreoN8nCompleto): string {
  const cuerpo = correo.texto.trim() || sinHtml(correo.html);
  return [
    correo.asunto && `Asunto: ${correo.asunto}`,
    correo.de && `De: ${correo.de}`,
    correo.para && `Para: ${correo.para}`,
    correo.fecha && `Fecha: ${correo.fecha}`,
    cuerpo && `\n${cuerpo}`,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_TEXTO);
}

export function mensajeDe(causa: unknown): string {
  if (causa instanceof HttpException) {
    const respuesta = causa.getResponse();
    if (typeof respuesta === 'string') return respuesta;
    const mensaje = (respuesta as { message?: unknown }).message;
    if (typeof mensaje === 'string') return mensaje;
    if (Array.isArray(mensaje)) return mensaje.map(String).join('; ');
  }
  return causa instanceof Error
    ? causa.message
    : 'Error desconocido al ingresar el correo.';
}
