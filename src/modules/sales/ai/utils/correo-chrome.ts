/**
 * Cabeceras de correo (De / Para / Asunto) para origen_texto.
 */

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
