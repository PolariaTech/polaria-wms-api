import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const MAX_BYTES = 15 * 1024 * 1024;
const BUCKET = 'ov-adjuntos';

function sanitizeCuentaFolder(codigoCuenta: string): string {
  const raw = codigoCuenta.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return raw.slice(0, 64) || 'sin-cuenta';
}

/**
 * Clave segura para Supabase Storage (igual que web).
 * Acentos/espacios (p. ej. «Café») provocaban "Invalid key".
 */
function sanitizeFileName(name: string): string {
  const trimmed = name.trim() || 'adjunto';
  const lastDot = trimmed.lastIndexOf('.');
  const stem = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const ext = lastDot > 0 ? trimmed.slice(lastDot + 1) : '';

  const asciiStem = stem
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 100);

  const asciiExt = ext
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, 16)
    .toLowerCase();

  const safeStem = asciiStem || 'adjunto';
  return asciiExt ? `${safeStem}.${asciiExt}` : safeStem;
}

function getAdmin() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let bucketReady: Promise<boolean> | null = null;

async function ensureBucket(): Promise<boolean> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const admin = getAdmin();
      if (!admin) return false;
      const { data: buckets, error: listError } =
        await admin.storage.listBuckets();
      if (listError) return false;
      if ((buckets ?? []).some((b) => b.name === BUCKET)) return true;
      const { error } = await admin.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_BYTES,
      });
      return !error || /already exists/i.test(error.message);
    })();
  }
  return bucketReady;
}

export type OvAdjuntoMeta = {
  nombre: string;
  url: string;
  path: string;
  mime: string;
  bytes: number;
  resourceType: 'storage';
};

/** Sube buffer Multer a Supabase Storage, path aislado por cuenta. */
export async function uploadOvAdjuntoBuffer(input: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
  codigoCuenta: string;
}): Promise<
  | { ok: true; adjunto: OvAdjuntoMeta }
  | { ok: false; message: string }
> {
  if (input.size > MAX_BYTES) {
    return { ok: false, message: `«${input.originalname}» supera 15 MB.` };
  }

  const admin = getAdmin();
  if (!admin) {
    return {
      ok: false,
      message: 'Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para adjuntos.',
    };
  }

  if (!(await ensureBucket())) {
    return { ok: false, message: 'No se pudo preparar bucket ov-adjuntos.' };
  }

  const mime = (input.mimetype || 'application/octet-stream').toLowerCase();
  const nombre = input.originalname.trim() || 'adjunto';
  const path = `${sanitizeCuentaFolder(input.codigoCuenta)}/${randomUUID()}-${sanitizeFileName(nombre)}`;

  const { error } = await admin.storage.from(BUCKET).upload(path, input.buffer, {
    contentType: mime,
    upsert: false,
  });

  if (error) {
    return { ok: false, message: error.message || `Error al subir «${nombre}».` };
  }

  // El front sirve con /api/ov-adjuntos/file; guardamos path + url relativa.
  const url = `/api/ov-adjuntos/file?path=${encodeURIComponent(path)}&nombre=${encodeURIComponent(nombre)}`;

  return {
    ok: true,
    adjunto: {
      nombre,
      url,
      path,
      mime,
      bytes: input.size,
      resourceType: 'storage',
    },
  };
}

const DOC_EXT =
  /\.(pdf|xlsx?|xls|csv|docx?|pptx?|zip|rar|7z|txt|html?)$/i;

function isLikelyRealEmlAttachment(input: {
  contentDisposition?: string | null;
  filename?: string | null;
  contentType?: string | null;
}): boolean {
  const disposition = (input.contentDisposition ?? '').toLowerCase();
  const filename = (input.filename ?? '').trim();
  const mime = (input.contentType ?? '').toLowerCase();

  if (disposition === 'attachment') {
    if (!filename && mime.startsWith('image/')) return false;
    return true;
  }
  if (filename && DOC_EXT.test(filename)) return true;
  return false;
}

/**
 * Extrae adjuntos reales de un .eml (PDF/Excel/…) y los sube a storage.
 * Ignora logos inline de firma.
 */
export async function uploadAttachmentsFromEmlBuffer(input: {
  buffer: Buffer;
  codigoCuenta: string;
}): Promise<OvAdjuntoMeta[]> {
  const { simpleParser } = await import('mailparser');
  let parsed: Awaited<ReturnType<typeof simpleParser>>;
  try {
    parsed = await simpleParser(input.buffer);
  } catch {
    return [];
  }

  const out: OvAdjuntoMeta[] = [];
  for (const adjunto of parsed.attachments) {
    if (
      !isLikelyRealEmlAttachment({
        contentDisposition: adjunto.contentDisposition,
        filename: adjunto.filename,
        contentType: adjunto.contentType,
      })
    ) {
      continue;
    }

    const content = Buffer.isBuffer(adjunto.content)
      ? adjunto.content
      : Buffer.from(adjunto.content);
    const nombre =
      adjunto.filename?.trim() ||
      `adjunto${adjunto.contentType?.includes('pdf') ? '.pdf' : ''}`;
    const mime = adjunto.contentType || 'application/octet-stream';

    const result = await uploadOvAdjuntoBuffer({
      buffer: content,
      originalname: nombre,
      mimetype: mime,
      size: content.length,
      codigoCuenta: input.codigoCuenta,
    });
    if (result.ok) out.push(result.adjunto);
  }
  return out;
}

export async function uploadOvAdjuntosMulter(
  files: Express.Multer.File[],
  codigoCuenta: string,
): Promise<OvAdjuntoMeta[]> {
  const out: OvAdjuntoMeta[] = [];
  for (const file of files) {
    const result = await uploadOvAdjuntoBuffer({
      buffer: file.buffer,
      originalname: file.originalname || 'adjunto',
      mimetype: file.mimetype || 'application/octet-stream',
      size: file.size,
      codigoCuenta,
    });
    if (result.ok) {
      out.push(result.adjunto);
    }

    const name = (file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const isEml =
      name.endsWith('.eml') ||
      mime.includes('message/rfc822') ||
      mime === 'application/eml';
    if (isEml && file.buffer?.length) {
      const inner = await uploadAttachmentsFromEmlBuffer({
        buffer: file.buffer,
        codigoCuenta,
      });
      out.push(...inner);
    }
  }
  return out;
}

export function serializeOrigenArchivosJson(
  items: readonly OvAdjuntoMeta[],
): string | null {
  if (items.length === 0) return null;
  return JSON.stringify(
    items.map((item) => ({
      nombre: item.nombre,
      url: item.url,
      path: item.path,
      mime: item.mime,
      bytes: item.bytes,
      resourceType: item.resourceType,
    })),
  );
}
