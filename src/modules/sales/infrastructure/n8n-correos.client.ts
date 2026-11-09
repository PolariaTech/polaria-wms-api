import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

const TIMEOUT_OBTENER_MS = 60_000;
/** Un correo leído de Gmail se guarda un rato: abrirlo, bajar adjuntos e ingresarlo no lo piden otra vez. */
const CORREO_EN_MEMORIA_MS = 5 * 60_000;
/** Pocos y de corta vida: un correo con adjuntos puede pesar varios MB en memoria. */
const CORREOS_EN_MEMORIA_MAX = 5;

type Objeto = Record<string, unknown>;

const esObjeto = (valor: unknown): valor is Objeto =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

const texto = (valor: unknown): string | null =>
  typeof valor === 'string' && valor.trim() !== '' ? valor : null;

function aAdjunto(crudo: Objeto): CorreoN8nAdjunto | null {
  const nombre = texto(crudo.nombre);
  const base64 = texto(crudo.base64);
  if (!nombre || !base64) return null;
  return {
    nombre,
    mimeType: texto(crudo.mimeType) ?? 'application/octet-stream',
    base64,
  };
}

/**
 * Puente con n8n (REQ-104). El WMS no habla con Gmail ni con la API general de n8n: llama
 * a un webhook de un workflow puente, con una sola llave (`N8N_CORREOS_API_KEY`). El listado
 * de correos ya no pasa por aquí (POL-410): se lee de la tabla `correo_pedido_entrada`.
 *
 *  - POST {N8N_CORREOS_URL}/wms-correos-obtener  → { asunto, de, para, fecha, texto, html,
 *                                                    adjuntos: [{ nombre, mimeType, base64 }] }
 */
@Injectable()
export class N8nCorreosClient {
  private readonly enMemoria = new Map<
    string,
    { correo: CorreoN8nCompleto; expira: number }
  >();
  private readonly enCamino = new Map<string, Promise<CorreoN8nCompleto>>();

  constructor(private readonly config: ConfigService) {}

  /**
   * El correo completo. Se guarda unos minutos en memoria, y dos peticiones simultáneas por
   * el mismo correo comparten una sola lectura (un correo con adjuntos pesa varios MB).
   */
  obtener(messageId: string): Promise<CorreoN8nCompleto> {
    const guardado = this.leerDeMemoria(messageId);
    if (guardado) return Promise.resolve(guardado);

    const enCamino = this.enCamino.get(messageId);
    if (enCamino) return enCamino;

    const lectura = this.leerDeN8n(messageId)
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

  private leerDeMemoria(messageId: string): CorreoN8nCompleto | null {
    const ahora = Date.now();
    for (const [clave, entrada] of this.enMemoria) {
      if (entrada.expira <= ahora) this.enMemoria.delete(clave);
    }
    const entrada = this.enMemoria.get(messageId);
    if (!entrada) return null;
    this.enMemoria.delete(messageId);
    this.enMemoria.set(messageId, entrada); // el más usado queda al final
    return entrada.correo;
  }

  private guardarEnMemoria(messageId: string, correo: CorreoN8nCompleto): void {
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

  private async leerDeN8n(messageId: string): Promise<CorreoN8nCompleto> {
    const correo = await this.llamar(
      'wms-correos-obtener',
      { messageId },
      TIMEOUT_OBTENER_MS,
    );
    const adjuntos = (Array.isArray(correo.adjuntos) ? correo.adjuntos : [])
      .filter(esObjeto)
      .map(aAdjunto)
      .filter((adjunto): adjunto is CorreoN8nAdjunto => adjunto !== null);
    return {
      asunto: texto(correo.asunto) ?? '',
      de: texto(correo.de) ?? '',
      para: texto(correo.para) ?? '',
      fecha: texto(correo.fecha),
      texto: texto(correo.texto) ?? '',
      html: texto(correo.html) ?? '',
      adjuntos,
    };
  }

  private async llamar(
    ruta: string,
    cuerpo: unknown,
    timeoutMs: number,
  ): Promise<Objeto> {
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
    if (!esObjeto(json)) {
      throw new BadGatewayException({
        error: 'N8N_RESPUESTA_INVALIDA',
        message: 'n8n devolvió una respuesta que no se puede leer.',
      });
    }
    return json;
  }
}
