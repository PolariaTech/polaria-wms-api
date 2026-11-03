/**
 * Cabeceras de correo (De / Para / Asunto) para origen_texto.
 */

import { extractCorreoRemitenteBirchstreet } from './correo-remitente-birchstreet';

export type CorreoChrome = {
  from?: string;
  to?: string;
  subject?: string;
};

export type CorreoChromeParsed = CorreoChrome & { body: string };

export function formatMailAddress(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    const t = value.trim();
    return t || undefined;
  }
  if (typeof value === 'object' && 'text' in value) {
    const t = String((value as { text?: unknown }).text ?? '').trim();
    return t || undefined;
  }
  return undefined;
}

export function formatCorreoChromeBlock(chrome: CorreoChrome): string {
  const lines: string[] = [];
  if (chrome.from?.trim()) lines.push(`De: ${chrome.from.trim()}`);
  if (chrome.to?.trim()) lines.push(`Para: ${chrome.to.trim()}`);
  if (chrome.subject?.trim()) lines.push(`Asunto: ${chrome.subject.trim()}`);
  return lines.join('\n');
}

export function parseCorreoChromeFromText(raw: string): CorreoChromeParsed {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return { body: '' };

  const from =
    text.match(/^(?:\*+)?(?:De|From)(?:\*+)?\s*:\s*(.+)$/im)?.[1]?.trim() ||
    undefined;
  const to =
    text.match(/^(?:\*+)?(?:Para|To)(?:\*+)?\s*:\s*(.+)$/im)?.[1]?.trim() ||
    undefined;
  const subject =
    text.match(
      /^(?:\*+)?(?:Asunto|Subject)(?:\*+)?\s*:\s*(.+)$/im,
    )?.[1]?.trim() || undefined;

  let body = text;
  if (from || to || subject) {
    body = text
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        if (!t) return true;
        return !/^(?:\*+)?(?:De|From|Para|To|Asunto|Subject|Date|Fecha|Cc|Cco|Bcc|Enviado el|Sent)(?:\*+)?\s*:/i.test(
          t,
        );
      })
      .join('\n')
      .trim();
  }

  return { from, to, subject, body: body || text };
}

export function withCorreoChromePreserved(
  raw: string,
  cleanBody: (s: string) => string,
): string {
  const chrome = parseCorreoChromeFromText(raw);
  const cleaned = cleanBody(chrome.body || raw).trim();
  const block = formatCorreoChromeBlock(chrome);
  if (!block) return cleaned;
  if (!cleaned) return block;
  return `${block}\n\n${cleaned}`;
}

export function prependCorreoChromeToBody(
  chrome: CorreoChrome,
  body: string,
): string {
  const block = formatCorreoChromeBlock(chrome);
  const cuerpo = body.trim();
  if (!block) return cuerpo;
  if (!cuerpo) return block;
  return `${block}\n\n${cuerpo}`;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const CORREO_REMITENTE_GENERICO_RE = [
  /^bss_system@birchstreet\.net$/i,
  /^admonaguacatesdepuebla@gmail\.com$/i,
  /^ventas@aguacatesdepuebla\.com$/i,
  /^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon)@/i,
];

/** REQ-122: From genérico (BirchStreet, noreply, proveedor). */
export function isCorreoRemitenteGenerico(
  email: string | null | undefined,
): boolean {
  const value = (email ?? '').trim();
  if (!value) return false;
  return CORREO_REMITENTE_GENERICO_RE.some((re) => re.test(value));
}

export function extractEmailAddressFromHeaderValue(
  value: string | null | undefined,
): string | null {
  const text = value?.trim() ?? '';
  if (!text) return null;
  const angle = text.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (angle?.[1]) return angle[1].trim();
  const bare = text.match(EMAIL_RE);
  return bare?.[0]?.trim() || null;
}

/**
 * REQ-122: si De/From es genérico, busca mail humano en cuerpo/mailto.
 */
export function extractCorreoContactoDesdeTexto(
  raw: string | null | undefined,
): string | null {
  const text = (raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return null;

  const chrome = parseCorreoChromeFromText(text);
  const fromEmail = extractEmailAddressFromHeaderValue(chrome.from);
  const fromEsGenerico = isCorreoRemitenteGenerico(fromEmail);

  const toEmails = new Set(
    (chrome.to?.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()),
  );

  const pickBodyEmail = (): string | null => {
    const mailto = text.match(/mailto:([^\s"'<>]+)/i);
    if (mailto?.[1]) {
      try {
        const decoded = decodeURIComponent(mailto[1])
          .replace(/[<>]/g, '')
          .trim();
        const fromMailto =
          extractEmailAddressFromHeaderValue(decoded) || decoded;
        if (
          fromMailto.includes('@') &&
          !isCorreoRemitenteGenerico(fromMailto) &&
          !toEmails.has(fromMailto.toLowerCase())
        ) {
          return fromMailto;
        }
      } catch {
        /* ignore */
      }
    }

    const labeled = text.match(
      /(?:e-?mail|correo(?:\s+electr[oó]nico)?|contacto)\s*[:=]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    );
    if (labeled?.[1] && !isCorreoRemitenteGenerico(labeled[1])) {
      return labeled[1];
    }

    const all = text.match(EMAIL_RE) ?? [];
    for (const email of all) {
      const lower = email.toLowerCase();
      if (toEmails.has(lower)) continue;
      if (isCorreoRemitenteGenerico(email)) continue;
      if (fromEmail && lower === fromEmail.toLowerCase()) continue;
      return email;
    }
    return null;
  };

  if (fromEmail && !fromEsGenerico) return fromEmail;
  // REQ-239: en BirchStreet el remitente real va bajo «Sent By» / «Sent From», no en CONTACTO.
  const fromBody = extractCorreoRemitenteBirchstreet(text) ?? pickBodyEmail();
  if (fromBody) return fromBody;
  return fromEmail;
}
