import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  parsearMensajeGmail,
  type AdjuntoGmailMeta,
  type CorreoGmailLeido,
  type MensajeGmail,
} from './gmail-correos.parse';

export interface AdjuntoGmailDescargable {
  nombre: string;
  mimeType: string;
  buffer: Buffer;
}

const TIMEOUT_MENSAJE_MS = 20_000;
const TIMEOUT_ADJUNTO_MS = 30_000;
const CORREO_EN_MEMORIA_MS = 5 * 60_000;
const CORREOS_EN_MEMORIA_MAX = 5;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users';

type Objeto = Record<string, unknown>;

const esObjeto = (valor: unknown): valor is Objeto =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/**
 * Lectura del buzón compartido de pedidos (REQ-317). El listado sigue en SQL; n8n
 * sigue clasificando. Aquí solo se sustituye `wms-correos-obtener`: el cuerpo sale
 * de `messages.get` y cada archivo de `attachments.get`, sin bajar todos los PDF.
 */
@Injectable()
export class GmailCorreosClient {
  private readonly enMemoria = new Map<
    string,
    { correo: CorreoGmailLeido; expira: number }
  >();
  private readonly enCamino = new Map<string, Promise<CorreoGmailLeido>>();
  private acceso: { token: string; expira: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  obtener(messageId: string): Promise<CorreoGmailLeido> {
    const guardado = this.leerDeMemoria(messageId);
    if (guardado) return Promise.resolve(guardado);
    const enCamino = this.enCamino.get(messageId);
    if (enCamino) return enCamino;
    const lectura = this.leerDeGmail(messageId)
      .then((correo) => {
        this.guardarEnMemoria(messageId, correo);
        return correo;
      })
      .finally(() => {
        this.enCamino.delete(messageId);
      });
    this.enCamino.set(messageId, lectura);
    return lectura;
  }

  async descargarAdjunto(
    messageId: string,
    indice: number,
  ): Promise<AdjuntoGmailDescargable> {
    const correo = await this.obtener(messageId);
    const adjunto = correo.adjuntos[indice];
    if (!adjunto) {
      throw new NotFoundException({
        error: 'ADJUNTO_NO_ENCONTRADO',
        message: 'El correo no tiene un adjunto en esa posición.',
      });
    }
    const buffer = await this.bytesDelAdjunto(messageId, adjunto);
    return { nombre: adjunto.nombre, mimeType: adjunto.mimeType, buffer };
  }

  private async bytesDelAdjunto(
    messageId: string,
    adjunto: AdjuntoGmailMeta,
  ): Promise<Buffer> {
    if (adjunto.datos && adjunto.datos.length > 0) return adjunto.datos;
    if (!adjunto.attachmentId) {
      throw new NotFoundException({
        error: 'ADJUNTO_NO_ENCONTRADO',
        message: 'El correo no tiene un adjunto en esa posición.',
      });
    }
    const json = await this.llamarJson(
      `${this.urlUsuario()}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(adjunto.attachmentId)}`,
      TIMEOUT_ADJUNTO_MS,
    );
    const datos = typeof json.data === 'string' ? json.data : '';
    if (!datos) {
      throw new BadGatewayException({
        error: 'GMAIL_ERROR',
        message: 'Gmail devolvió un adjunto vacío.',
      });
    }
    return Buffer.from(datos.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  }

  private async leerDeGmail(messageId: string): Promise<CorreoGmailLeido> {
    const json = await this.llamarJson(
      `${this.urlUsuario()}/messages/${encodeURIComponent(messageId)}?format=full`,
      TIMEOUT_MENSAJE_MS,
    );
    return parsearMensajeGmail(json as MensajeGmail);
  }

  private urlUsuario(): string {
    const usuario = this.config.get<string>('GMAIL_CORREOS_USER')?.trim() || 'me';
    return `${GMAIL_API}/${encodeURIComponent(usuario)}`;
  }

  private leerDeMemoria(messageId: string): CorreoGmailLeido | null {
    const ahora = Date.now();
    for (const [clave, entrada] of this.enMemoria) {
      if (entrada.expira <= ahora) this.enMemoria.delete(clave);
    }
    const entrada = this.enMemoria.get(messageId);
    if (!entrada) return null;
    this.enMemoria.delete(messageId);
    this.enMemoria.set(messageId, entrada);
    return entrada.correo;
  }

  private guardarEnMemoria(messageId: string, correo: CorreoGmailLeido): void {
    this.enMemoria.set(messageId, {
      correo,
      expira: Date.now() + CORREO_EN_MEMORIA_MS,
    });
    while (this.enMemoria.size > CORREOS_EN_MEMORIA_MAX) {
      const masViejo = [...this.enMemoria.keys()][0];
      if (masViejo === undefined) break;
      this.enMemoria.delete(masViejo);
    }
  }

  private credenciales(): { id: string; secreto: string; refresh: string } {
    const id = this.config.get<string>('GMAIL_CORREOS_CLIENT_ID')?.trim();
    const secreto = this.config.get<string>('GMAIL_CORREOS_CLIENT_SECRET')?.trim();
    const refresh = this.config.get<string>('GMAIL_CORREOS_REFRESH_TOKEN')?.trim();
    if (!id || !secreto || !refresh) {
      throw new ServiceUnavailableException({
        error: 'CORREOS_NO_CONFIGURADOS',
        message: 'Los correos de Gmail no están configurados en este entorno.',
      });
    }
    return { id, secreto, refresh };
  }

  private async tokenDeAcceso(): Promise<string> {
    if (this.acceso && this.acceso.expira > Date.now() + 30_000) {
      return this.acceso.token;
    }
    const { id, secreto, refresh } = this.credenciales();
    const cuerpo = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: id,
      client_secret: secreto,
      refresh_token: refresh,
    });
    const json = await this.enviar(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo.toString(),
      timeoutMs: 15_000,
    });
    const token = typeof json.access_token === 'string' ? json.access_token : '';
    const segundos =
      typeof json.expires_in === 'number' ? json.expires_in : 3600;
    if (!token) {
      throw new BadGatewayException({
        error: 'GMAIL_ERROR',
        message: 'Gmail no entregó un token de acceso.',
      });
    }
    this.acceso = { token, expira: Date.now() + segundos * 1000 };
    return token;
  }

  private async llamarJson(url: string, timeoutMs: number): Promise<Objeto> {
    const token = await this.tokenDeAcceso();
    return this.enviar(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs,
    });
  }

  private async enviar(
    url: string,
    opciones: {
      method: 'GET' | 'POST';
      headers: Record<string, string>;
      body?: string;
      timeoutMs: number;
    },
  ): Promise<Objeto> {
    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        method: opciones.method,
        headers: opciones.headers,
        body: opciones.body,
        signal: AbortSignal.timeout(opciones.timeoutMs),
      });
    } catch {
      throw new BadGatewayException({
        error: 'GMAIL_NO_RESPONDE',
        message: 'Gmail no respondió a tiempo. Intenta de nuevo en un momento.',
      });
    }
    if (respuesta.status === 404) {
      throw new BadGatewayException({
        error: 'GMAIL_ERROR',
        message: 'Gmail no encontró ese correo.',
      });
    }
    if (!respuesta.ok) {
      throw new BadGatewayException({
        error: 'GMAIL_ERROR',
        message: `Gmail respondió con error (${respuesta.status}).`,
      });
    }
    const json: unknown = await respuesta.json().catch(() => null);
    if (!esObjeto(json)) {
      throw new BadGatewayException({
        error: 'GMAIL_RESPUESTA_INVALIDA',
        message: 'Gmail devolvió una respuesta que no se puede leer.',
      });
    }
    return json;
  }
}
