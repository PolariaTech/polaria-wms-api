/**
 * Limpia teléfonos que llegan URL-encoded desde correos (tel:, %20, etc.).
 * REQ-030: espacios no deben verse como "%20".
 */
export function sanitizeTelefonoContacto(
  value: string | null | undefined,
): string {
  let text = (value ?? '').trim();
  if (!text) return '';

  text = text.replace(/^tel:\s*/i, '');

  for (let i = 0; i < 3; i += 1) {
    if (!/%[0-9A-Fa-f]{2}/.test(text)) break;
    try {
      const decoded = decodeURIComponent(text);
      if (decoded === text) break;
      text = decoded;
    } catch {
      text = text.replace(/%20/gi, ' ');
      break;
    }
  }

  text = text.replace(/%20/gi, ' ');
  text = text.replace(/[\u00a0\u2007\u202f]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export function sanitizeTelefonoContactoOrNull(
  value: string | null | undefined,
): string | null {
  const cleaned = sanitizeTelefonoContacto(value);
  return cleaned || null;
}
