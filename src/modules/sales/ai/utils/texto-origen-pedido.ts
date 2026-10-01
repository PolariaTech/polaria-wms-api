import type { ArchivoExtraido, ArchivoTexto } from "../file-extractors";

const LEGAL_CUT_MARKERS = [
  /la presente comunicaci[oó]n electr[oó]nica/i,
  /this electronic communication is confidential/i,
  /el presente correo no constituye/i,
];

const FORWARD_HEADER_END =
  /^(?:-+)\s*Forwarded message\s*(?:-+)\s*$/im;

const HEADER_START =
  /^(?:De|From|Date|Fecha|Subject|Asunto|To|Para|Cc|Cco|Bcc|Enviado el|Sent):/i;

const MAX_TEXTO_ORIGEN_CHARS = 12000;

function isArchivoTexto(file: ArchivoExtraido): file is ArchivoTexto {
  return file.tipo === "texto";
}

/** Tras cabeceras de correo (De/From/…), el cuerpo empieza después de la línea en blanco. */
function stripEmailHeadersBlock(text: string): string {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i]!.trim()) i += 1;
  if (i >= lines.length || !HEADER_START.test(lines[i]!.trim())) {
    return text.trim();
  }
  while (i < lines.length && lines[i]!.trim()) i += 1;
  while (i < lines.length && !lines[i]!.trim()) i += 1;
  return lines.slice(i).join("\n").trim();
}

/** Línea con columnas alineadas por espacios (salida dataTable de html-to-text). */
export function looksLikeAsciiTableRow(line: string): boolean {
  const trimmed = line.replace(/\s+$/g, "");
  if (!trimmed.trim()) return false;
  return trimmed.trim().split(/ {2,}/).filter(Boolean).length >= 3;
}

function normalizeLinePreserveTables(line: string): string {
  if (looksLikeAsciiTableRow(line)) {
    return line.replace(/[ \t]+$/g, "");
  }
  return line.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/g, "");
}

/**
 * Extrae solo el cuerpo legible del mensaje (sin cabeceras de forward ni legales).
 * Conserva el espaciado de tablas ASCII para que sigan leyéndose en columnas.
 */
export function cleanCorreoBodyForNotas(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  const forwardMatch = FORWARD_HEADER_END.exec(text);
  if (forwardMatch?.index != null) {
    text = text.slice(forwardMatch.index + forwardMatch[0].length).trim();
  }

  text = stripEmailHeadersBlock(text);

  for (const marker of LEGAL_CUT_MARKERS) {
    const match = marker.exec(text);
    if (match?.index != null && match.index > 20) {
      text = text.slice(0, match.index).trim();
      break;
    }
  }

  text = text
    .split("\n")
    .map(normalizeLinePreserveTables)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length > MAX_TEXTO_ORIGEN_CHARS) {
    text = `${text.slice(0, MAX_TEXTO_ORIGEN_CHARS).trim()}…`;
  }

  return text;
}

/** Compacta saltos de línea para que el PDF llene las N líneas sin huecos vacíos. */
export function flattenNotasForPdf(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export type OrigenPedidoBlock =
  | { type: "text"; text: string }
  | { type: "table"; rows: string[][] };

/**
 * Parte el cuerpo en prosa + tablas ASCII (columnas separadas por 2+ espacios).
 * Sirve para renderizar tablas reales en la UI.
 */
export function parseOrigenPedidoBlocks(raw: string): OrigenPedidoBlock[] {
  const text = cleanCorreoBodyForNotas(raw);
  if (!text) return [];

  const lines = text.split("\n");
  const blocks: OrigenPedidoBlock[] = [];
  let prose: string[] = [];
  let tableLines: string[] = [];

  const flushProse = () => {
    const joined = prose.join("\n").trim();
    if (joined) blocks.push({ type: "text", text: joined });
    prose = [];
  };

  const flushTable = () => {
    if (tableLines.length === 0) return;
    const rows = tableLines.map((line) =>
      line.replace(/[ \t]+$/g, "").split(/ {2,}/).map((cell) => cell.trim()),
    );
    const colCount = Math.max(...rows.map((r) => r.length), 0);
    if (colCount >= 3 && rows.length >= 1) {
      const normalized = rows.map((row) => {
        const next = [...row];
        while (next.length < colCount) next.push("");
        return next;
      });
      blocks.push({ type: "table", rows: normalized });
    } else {
      prose.push(...tableLines);
    }
    tableLines = [];
  };

  for (const line of lines) {
    if (looksLikeAsciiTableRow(line)) {
      if (prose.length) flushProse();
      tableLines.push(line);
      continue;
    }
    if (tableLines.length) flushTable();
    prose.push(line);
  }
  flushTable();
  flushProse();

  return blocks;
}

/**
 * Texto a persistir en origen_texto / notas generales del PDF.
 * Prioridad: mensaje pegado → cuerpos de .eml → otros textos sueltos (no adjuntos).
 */
export function buildTextoOrigenPedido(
  textoPegado: string,
  archivosExtraidos: readonly ArchivoExtraido[],
): string {
  const pegado = cleanCorreoBodyForNotas(textoPegado);
  if (pegado) return pegado;

  const cuerpos = archivosExtraidos
    .filter(isArchivoTexto)
    .filter((file) => /—\s*cuerpo$/i.test(file.nombre))
    .map((file) => cleanCorreoBodyForNotas(file.contenido))
    .filter(Boolean);

  if (cuerpos.length > 0) {
    return cuerpos.join("\n\n---\n\n");
  }

  const sueltos = archivosExtraidos
    .filter(isArchivoTexto)
    .filter((file) => !file.nombre.includes(" → "))
    .map((file) => cleanCorreoBodyForNotas(file.contenido))
    .filter(Boolean);

  return sueltos.join("\n\n---\n\n");
}
