import { createClient } from '@supabase/supabase-js';

export const LOGO_EMPRESA_MAX_BYTES = 1_048_576;
const BUCKET = 'empresa-logos';

const EXTENSION_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export function validarLogoEmpresa(archivo: {
  size: number;
  mimetype: string;
}): string | null {
  if (archivo.size > LOGO_EMPRESA_MAX_BYTES) {
    return 'El logo supera 1 MB.';
  }
  if (!EXTENSION_POR_MIME[archivo.mimetype.toLowerCase()]) {
    return 'El logo debe ser JPEG o PNG.';
  }
  return null;
}

function clienteStorage() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function subirLogoEmpresa(input: {
  codigoEmpresa: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
  logoPathAnterior: string | null;
}): Promise<{ ok: true; logoPath: string } | { ok: false; message: string }> {
  const mensaje = validarLogoEmpresa(input);
  if (mensaje) return { ok: false, message: mensaje };

  const admin = clienteStorage();
  if (!admin) {
    return {
      ok: false,
      message: 'Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el logo.',
    };
  }

  const extension = EXTENSION_POR_MIME[input.mimetype.toLowerCase()];
  const logoPath = `${input.codigoEmpresa}/logo.${extension}`;
  const { error } = await admin.storage.from(BUCKET).upload(logoPath, input.buffer, {
    contentType: input.mimetype.toLowerCase(),
    upsert: true,
  });
  if (error) {
    return { ok: false, message: error.message || 'No se pudo guardar el logo.' };
  }

  if (input.logoPathAnterior && input.logoPathAnterior !== logoPath) {
    await admin.storage.from(BUCKET).remove([input.logoPathAnterior]);
  }

  return { ok: true, logoPath };
}
