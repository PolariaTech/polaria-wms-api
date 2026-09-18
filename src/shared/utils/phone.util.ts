const EMAIL_RE = /@/;

/** Dígitos de un identificador telefónico (sin +). */
export function phoneDigits(raw: string): string {
  return raw.trim().replace(/\D/g, '');
}

/**
 * Normaliza a E.164 simple (CO por defecto si son 10 dígitos móviles).
 * Devuelve null si no parece un teléfono.
 */
export function normalizePhoneIdentificador(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || EMAIL_RE.test(trimmed)) return null;

  const digits = phoneDigits(trimmed);
  if (digits.length < 8 || digits.length > 15) return null;

  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`;
  if (digits.length === 12 && digits.startsWith('57')) return `+${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return null;
}

export function isPhoneIdentificador(raw: string): boolean {
  return normalizePhoneIdentificador(raw) !== null;
}

export function phoneLookupVariants(raw: string): string[] {
  const e164 = normalizePhoneIdentificador(raw);
  if (!e164) return [];

  const digits = phoneDigits(e164);
  const variants = [e164, `+${digits}`, digits];
  if (digits.startsWith('57') && digits.length === 12) {
    variants.push(digits.slice(2));
    variants.push(`+${digits.slice(2)}`);
  }
  return [...new Set(variants.filter(Boolean))];
}

export type ParsedProfileTelefono =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'ok'; value: string };

/** Vacío/null → empty. Texto que no es teléfono → invalid. Válido → E.164. */
export function parseProfileTelefono(
  raw: string | null | undefined,
): ParsedProfileTelefono {
  if (raw == null) return { kind: 'empty' };
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'empty' };
  const e164 = normalizePhoneIdentificador(trimmed);
  if (!e164) return { kind: 'invalid' };
  return { kind: 'ok', value: e164 };
}

export const TELEFONO_DUPLICADO =
  'Ese teléfono ya está registrado en otra cuenta';
export const TELEFONO_INVALIDO = 'El teléfono no es válido';
