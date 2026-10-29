import { createClient } from '@supabase/supabase-js';
import type { ArchivoSubido } from './file-extractors';
import {
  sanitizeCuentaFolder,
  type OvAdjuntoMeta,
} from './upload-ov-adjunto-cloudinary';

/**
 * Descarga de los adjuntos originales de una OV desde el bucket privado `ov-adjuntos`
 * (REQ-187). Se usa la service role, que salta RLS: por eso los paths NUNCA vienen del
 * cliente. Salen de `orden_venta.origen_archivos` de una OV ya autorizada para el
 * tenant, y aun así se revalidan aquí (carpeta de la cuenta, sin `..`).
 */

const BUCKET = 'ov-adjuntos';
const MAX_ARCHIVOS = 8;
const MAX_BYTES = 15 * 1024 * 1024;

export type MotivoAdjuntoRechazado =
  | 'PATH_FUERA_DE_CUENTA'
  | 'SUPERA_TOPE_BYTES'
  | 'NO_DISPONIBLE';

export interface AdjuntoRechazado {
  nombre: string;
  motivo: MotivoAdjuntoRechazado;
}

export interface AdjuntosDescargados {
  archivos: ArchivoSubido[];
  /** Metadatos de lo descargado (para el hash base de la propuesta). */
  descargados: Array<{ nombre: string; path: string; bytes: number }>;
  rechazados: AdjuntoRechazado[];
  /** Había más adjuntos que el tope: se descargaron solo los primeros. */
  excedeTope: boolean;
}

/** `origen_archivos` guarda JSON (con path) o, en OV viejas, solo nombres en texto libre. */
export function parseOrigenArchivos(
  valor: string | null | undefined,
): OvAdjuntoMeta[] {
  if (!valor?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(valor);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is OvAdjuntoMeta =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as OvAdjuntoMeta).path === 'string' &&
        typeof (item as OvAdjuntoMeta).nombre === 'string',
    );
  } catch {
    return [];
  }
}

/** El path debe estar dentro de la carpeta de la cuenta y no escapar con `..`. */
export function pathPerteneceACuenta(
  path: string,
  codigoCuenta: string,
): boolean {
  const carpeta = sanitizeCuentaFolder(codigoCuenta);
  if (!path.startsWith(`${carpeta}/`)) return false;
  if (path.startsWith('/') || path.includes('\\')) return false;
  return !path.split('/').some((segmento) => segmento === '..' || segmento === '');
}

function getAdmin() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function descargarAdjuntosOv(
  adjuntos: readonly OvAdjuntoMeta[],
  codigoCuenta: string,
): Promise<AdjuntosDescargados> {
  const resultado: AdjuntosDescargados = {
    archivos: [],
    descargados: [],
    rechazados: [],
    excedeTope: adjuntos.length > MAX_ARCHIVOS,
  };

  const admin = getAdmin();
  const candidatos = adjuntos.slice(0, MAX_ARCHIVOS);

  for (const adjunto of candidatos) {
    if (!pathPerteneceACuenta(adjunto.path, codigoCuenta)) {
      resultado.rechazados.push({
        nombre: adjunto.nombre,
        motivo: 'PATH_FUERA_DE_CUENTA',
      });
      continue;
    }
    if (typeof adjunto.bytes === 'number' && adjunto.bytes > MAX_BYTES) {
      resultado.rechazados.push({
        nombre: adjunto.nombre,
        motivo: 'SUPERA_TOPE_BYTES',
      });
      continue;
    }
    if (!admin) {
      resultado.rechazados.push({
        nombre: adjunto.nombre,
        motivo: 'NO_DISPONIBLE',
      });
      continue;
    }

    const { data, error } = await admin.storage
      .from(BUCKET)
      .download(adjunto.path);
    if (error || !data) {
      resultado.rechazados.push({
        nombre: adjunto.nombre,
        motivo: 'NO_DISPONIBLE',
      });
      continue;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    // El tamaño declarado en la OV no es confiable: se verifica el real.
    if (buffer.length > MAX_BYTES) {
      resultado.rechazados.push({
        nombre: adjunto.nombre,
        motivo: 'SUPERA_TOPE_BYTES',
      });
      continue;
    }

    resultado.archivos.push({
      originalname: adjunto.nombre,
      mimetype: adjunto.mime || 'application/octet-stream',
      buffer,
    });
    resultado.descargados.push({
      nombre: adjunto.nombre,
      path: adjunto.path,
      bytes: buffer.length,
    });
  }

  return resultado;
}
