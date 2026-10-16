import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const MAX_BYTES = 15 * 1024 * 1024;
const BUCKET = 'ov-adjuntos';

function sanitizeCuentaFolder(codigoCuenta: string): string {
  const raw = codigoCuenta.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return raw.slice(0, 64) || 'sin-cuenta';
}

function sanitizeFileName(name: string): string {
  const base = name.trim().replace(/[/\\?%*:|"<>]/g, '_') || 'adjunto';
  return base.slice(0, 120);
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
