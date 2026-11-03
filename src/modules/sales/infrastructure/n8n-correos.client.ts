import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ModoCorreos } from '../dto/correos-query.dto';

/** Fila del data table `correos_aguacates_entrada`, ya con nombres en camelCase. */
export interface CorreoN8nFila {
  recibidoEn: string | null;
  de: string | null;
  para: string | null;
  asunto: string | null;
  messageId: string;
  hilo: string | null;
  adjunto: string | null;
  nuevoPedido: boolean | null;
  motivo: string | null;
}

export interface ListarCorreosN8nInput {
  modo: ModoCorreos;
  pagina: number;
  tamano: number;
  desde?: string;
  hasta?: string;
  remitente?: string;
  asunto?: string;
}

export interface ListarCorreosN8nResultado {
  total: number;
  filas: CorreoN8nFila[];
}

export interface CorreoN8nAdjunto {
  nombre: string;
  mimeType: string;
  base64: string;
}

export interface CorreoN8nCompleto {
  asunto: string;
  de: string;
  para: string;
  fecha: string | null;
  texto: string;
  html: string;
  adjuntos: CorreoN8nAdjunto[];
}

const TIMEOUT_LISTAR_MS = 20_000;
const TIMEOUT_OBTENER_MS = 60_000;

type Obj = Record<string, unknown>;

const esObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const texto = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v : null;

/**
 * Puente con n8n (REQ-104). El WMS no habla con Gmail ni con la API general de n8n: llama
 * a dos webhooks de un workflow puente, con una sola llave (`N8N_CORREOS_API_KEY`).
 *
 *  - POST {N8N_CORREOS_URL}/wms-correos-listar   → { total, filas: [fila del data table] }
 *  - POST {N8N_CORREOS_URL}/wms-correos-obtener  → { asunto, de, para, fecha, texto, html,
 *                                                    adjuntos: [{ nombre, mimeType, base64 }] }
 */
@Injectable()
export class N8nCorreosClient {
  constructor(private readonly config: ConfigService) {}

  async listar(
    input: ListarCorreosN8nInput,
  ): Promise<ListarCorreosN8nResultado> {
    const cuerpo = await this.llamar(
      'wms-correos-listar',
      { ...input, soloDescartados: input.modo === 'descartados' },
      TIMEOUT_LISTAR_MS,
    );
    const filas = Array.isArray(cuerpo.filas) ? cuerpo.filas : [];
    const mapeadas = filas.filter(esObj).flatMap((f) => {
      const messageId = texto(f.message_id);
      if (!messageId) return [];
      const fila: CorreoN8nFila = {
        recibidoEn: texto(f.recibido_en),
        de: texto(f.de),
        para: texto(f.para),
        asunto: texto(f.asunto),
        messageId,
        hilo: texto(f.hilo),
        adjunto: texto(f.adjunto),
        nuevoPedido:
          typeof f.nuevo_pedido === 'boolean' ? f.nuevo_pedido : null,
        motivo: texto(f.motivo),
      };
      return [fila];
    });
    const total =
      typeof cuerpo.total === 'number' && Number.isFinite(cuerpo.total)
        ? cuerpo.total
        : mapeadas.length;
    return { total, filas: mapeadas };
  }

  async obtener(messageId: string): Promise<CorreoN8nCompleto> {
    const c = await this.llamar(
      'wms-correos-obtener',
      { messageId },
      TIMEOUT_OBTENER_MS,
    );
    const adjuntos = (Array.isArray(c.adjuntos) ? c.adjuntos : [])
      .filter(esObj)
      .flatMap((a) => {
        const nombre = texto(a.nombre);
        const base64 = texto(a.base64);
        if (!nombre || !base64) return [];
        const adjunto: CorreoN8nAdjunto = {
          nombre,
          mimeType: texto(a.mimeType) ?? 'application/octet-stream',
          base64,
        };
        return [adjunto];
      });
    return {
      asunto: texto(c.asunto) ?? '',
      de: texto(c.de) ?? '',
      para: texto(c.para) ?? '',
      fecha: texto(c.fecha),
      texto: texto(c.texto) ?? '',
      html: texto(c.html) ?? '',
      adjuntos,
    };
  }

  private async llamar(
    ruta: string,
    cuerpo: unknown,
    timeoutMs: number,
  ): Promise<Obj> {
    const base = this.config
      .get<string>('N8N_CORREOS_URL')
      ?.trim()
      .replace(/\/+$/, '');
    const llave = this.config.get<string>('N8N_CORREOS_API_KEY')?.trim();
    if (!base || !llave) {
      throw new ServiceUnavailableException({
        error: 'CORREOS_NO_CONFIGURADOS',
        message: 'Los correos de n8n no están configurados en este entorno.',
      });
    }

    let respuesta: Response;
    try {
      respuesta = await fetch(`${base}/${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': llave },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new BadGatewayException({
        error: 'N8N_NO_RESPONDE',
        message: 'n8n no respondió a tiempo. Intenta de nuevo en un momento.',
      });
    }

    if (!respuesta.ok) {
      throw new BadGatewayException({
        error: 'N8N_ERROR',
        message: `n8n respondió con error (${respuesta.status}).`,
      });
    }

    const json: unknown = await respuesta.json().catch(() => null);
    if (!esObj(json)) {
      throw new BadGatewayException({
        error: 'N8N_RESPUESTA_INVALIDA',
        message: 'n8n devolvió una respuesta que no se puede leer.',
      });
    }
    return json;
  }
}
