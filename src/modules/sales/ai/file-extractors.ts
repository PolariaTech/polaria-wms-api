import path from "node:path";
import { convert as htmlToText } from "html-to-text";
import { simpleParser } from "mailparser";
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

const TEXT_EXTENSIONS = new Set([".csv", ".txt"]);
const IMAGE_MIME_PREFIX = "image/";
// .doc/.xls/.ppt viejos (formato OLE Compound File Binary) comparten la misma firma de
// magic bytes — no se pueden distinguir entre sí sin un parser más profundo.
const COMPOUND_BINARY_MIME = "application/x-cfb";

export interface ArchivoTexto {
  nombre: string;
  tipo: "texto";
  contenido: string;
}

export interface ArchivoImagen {
  nombre: string;
  tipo: "imagen";
  mime: string;
  base64: string;
}

export interface ArchivoNoLegible {
  nombre: string;
  tipo: "no_legible";
  motivo: string;
}

export type ArchivoExtraido = ArchivoTexto | ArchivoImagen | ArchivoNoLegible;

/** Forma mínima de archivo en memoria (sin depender de Express.Multer). */
export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // unpdf en vez de pdf-parse: pdf-parse (basado en un build vendored viejo de pdf.js)
  // corrompe su estado interno entre llamadas sucesivas en el mismo proceso — la
  // primera extracción de PDF del proceso funciona, la segunda devuelve texto casi
  // vacío y además lanza un unhandledRejection asíncrono que tumba el servidor
  // completo. Verificado con archivos reales (ver casos_de_uso/pdf/); unpdf no lo
  // reproduce ni en llamadas secuenciales ni concurrentes.
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}

function extractFromExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return `# Hoja: ${name}\n${csv}`;
  }).join("\n\n");
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

// Adjunto/cuerpo .html real encontrado en correos de sistemas automáticos de PO
// (Marriott/Sheraton): traen la orden de compra completa renderizada como HTML. Se
// convierte a texto plano en vez de mandarle el markup crudo a la IA (ruido de tags,
// estilos, y entidades HTML sin decodificar como "&Oacute;").
// Tablas HTML → dataTable (columnas alineadas); el default de html-to-text aplasta
// celdas en una sola línea o en lista vertical ilegible.
function extractFromHtml(buffer: Buffer): string {
  return htmlToText(buffer.toString("utf8"), {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      {
        selector: "table",
        format: "dataTable",
        options: {
          uppercaseHeaderCells: false,
          maxColumnWidth: 32,
        },
      },
    ],
  }).trim();
}

function htmlTieneTabla(html: string): boolean {
  return /<table[\s>]/i.test(html);
}

/**
 * El text/plain de Outlook/Gmail suele “aplastar” tablas (una celda por línea).
 * Si hay HTML con <table>, preferimos ese camino con dataTable.
 */
function extractCuerpoCorreo(parsed: {
  text?: string | null;
  html?: string | false | null;
}): string {
  const plain = parsed.text?.trim() || "";
  const htmlRaw =
    typeof parsed.html === "string" && parsed.html.trim()
      ? parsed.html
      : "";
  const fromHtml = htmlRaw ? extractFromHtml(Buffer.from(htmlRaw)) : "";

  if (htmlRaw && htmlTieneTabla(htmlRaw) && fromHtml) {
    return fromHtml;
  }
  return plain || fromHtml;
}

/**
 * AUDITORÍA 2026-09-03 · Hallazgo #8 (Medio) — el ruteo imagen-vs-texto se decidía
 * 100% por el `Content-Type` que declara el cliente en el multipart (spoofable) — en la
 * auditoría, un PDF real enviado con `Content-Type: image/png` fue ruteado como imagen y
 * llegó a la API de visión de OpenAI, que lo rechazó, gastando la llamada igual sin que
 * el backend lo hubiera podido evitar. Fix: se leen los magic bytes reales del contenido
 * (`file-type`, sniffing binario, no confía en nada declarado por el cliente) y esos
 * mandan sobre el mimetype/extensión declarados.
 * `file-type` v22 es ESM-only (sin build CJS). Nest usa moduleResolution node,
 * así que el import dinámico tipado falla en compile-time; se carga vía Function.
 */
async function detectarTipoReal(
  buffer: Buffer,
): Promise<{ ext?: string; mime?: string }> {
  type FileTypeMod = {
    fileTypeFromBuffer: (
      input: Uint8Array,
    ) => Promise<{ ext: string; mime: string } | undefined>;
  };
  const { fileTypeFromBuffer } = (await (
    Function('return import("file-type")') as () => Promise<FileTypeMod>
  )()) as FileTypeMod;
  const resultado = await fileTypeFromBuffer(buffer);
  return resultado ? { ext: resultado.ext, mime: resultado.mime } : {};
}

// Extraída de extractFile() para poder reutilizarla tanto en el archivo subido
// directo como en cada adjunto real de un correo .eml (extractFromEml) sin duplicar la
// cadena de detección de formato.
async function extraerContenidoPorTipo(
  buffer: Buffer,
  extReal: string,
  extDeclarada: string,
): Promise<Omit<ArchivoTexto, "nombre"> | Omit<ArchivoNoLegible, "nombre">> {
  try {
    if (extReal === ".pdf") {
      return { tipo: "texto", contenido: await extractFromPdf(buffer) };
    }
    if (extReal === ".xlsx" || extReal === ".xls") {
      return { tipo: "texto", contenido: extractFromExcel(buffer) };
    }
    if (extReal === ".docx") {
      return { tipo: "texto", contenido: await extractFromDocx(buffer) };
    }
    if (extReal === ".html" || extReal === ".htm") {
      return { tipo: "texto", contenido: extractFromHtml(buffer) };
    }
    if (TEXT_EXTENSIONS.has(extDeclarada)) {
      return { tipo: "texto", contenido: buffer.toString("utf8") };
    }
  } catch (err) {
    return { tipo: "no_legible", motivo: (err as Error).message };
  }
  return {
    tipo: "no_legible",
    motivo: "Formato sin lector disponible (ej. .doc)",
  };
}

// Soporte para correos .eml reenviados con la orden de compra adjunta — hallazgo real
// del prototipo (2026-09-08): 11 correos de hoteles/cadenas (Marriott, Hilton, etc.)
// reenviados tal cual (.eml, MIME multipart) caían enteros en "no_legible" porque esta
// extensión no tenía ningún lector, así que ni el cuerpo del correo ni sus adjuntos
// reales (PDF/Excel/HTML) llegaban nunca a la IA.
//
// Un .eml se expande en VARIOS ArchivoExtraido (por eso extractFile() devuelve un
// arreglo): el cuerpo del correo es uno, y cada adjunto real (Content-Disposition:
// "attachment", nunca "inline" — así se distinguen los logos de firma embebidos, que se
// ignoran) es otro, procesado con el mismo extraerContenidoPorTipo() de arriba y
// nombrado "<correo> → <adjunto>" para que quede trazable en archivosNoLegibles y en los
// logs. Un adjunto real que resulte ser una imagen (foto pegada como adjunto en vez de
// inline) también se ignora — no es el caso de uso de este flujo (las fotos van por el
// flujo de subida directa), y no hay evidencia de ese caso en los correos reales
// probados en el prototipo. Un .eml anidado dentro de otro tampoco se recursiona — sin
// evidencia real, fuera de alcance a propósito.
async function extractFromEml(
  buffer: Buffer,
  nombreOriginal: string,
): Promise<ArchivoExtraido[]> {
  let parsed: {
    text?: string | null;
    html?: string | false | null;
    attachments: Array<{
      contentDisposition?: string | null;
      filename?: string | null;
      content: Buffer;
    }>;
  };
  try {
    parsed = await simpleParser(buffer);
  } catch (err) {
    // Último recurso: el MIME crudo aún suele tener texto legible para la IA.
    const crudo = buffer.toString("utf8").trim();
    if (crudo.length > 0) {
      return [
        {
          nombre: `${nombreOriginal} — cuerpo`,
          tipo: "texto",
          contenido: crudo,
        },
      ];
    }
    return [
      { nombre: nombreOriginal, tipo: "no_legible", motivo: (err as Error).message },
    ];
  }

  const resultado: ArchivoExtraido[] = [];

  const cuerpo = extractCuerpoCorreo(parsed);
  if (cuerpo.trim()) {
    resultado.push({
      nombre: `${nombreOriginal} — cuerpo`,
      tipo: "texto",
      contenido: cuerpo,
    });
  }

  for (const adjunto of parsed.attachments) {
    if (adjunto.contentDisposition !== "attachment") continue; // ignora inline (logos de firma)

    const nombreAdjunto = adjunto.filename || "adjunto sin nombre";
    const nombre = `${nombreOriginal} → ${nombreAdjunto}`;
    const extDeclarada = path.extname(nombreAdjunto).toLowerCase();
    const real = await detectarTipoReal(adjunto.content);

    if (real.mime?.startsWith(IMAGE_MIME_PREFIX)) continue; // ver comentario de arriba

    const extReal =
      real.mime === COMPOUND_BINARY_MIME || !real.ext
        ? extDeclarada
        : `.${real.ext}`;
    const contenido = await extraerContenidoPorTipo(
      adjunto.content,
      extReal,
      extDeclarada,
    );
    resultado.push({ nombre, ...contenido } as ArchivoExtraido);
  }

  return resultado;
}

/**
 * Convierte un archivo subido a la forma que necesita el prompt de OpenAI:
 * - texto: contenido plano legible (pdf/xlsx/xls/csv/txt/docx/html/eml)
 * - imagen: base64 + mime, para mandarlo como content block de visión
 * - no_legible: formato sin parser disponible (ej. .doc legado)
 *
 * Devuelve un arreglo (no un solo ArchivoExtraido) porque un .eml puede expandirse en
 * varios ítems (cuerpo + adjuntos) — ver extractFromEml().
 */
async function extractFile(file: ArchivoSubido): Promise<ArchivoExtraido[]> {
  const extDeclarada = path.extname(file.originalname).toLowerCase();
  const nombre = file.originalname;

  const real = await detectarTipoReal(file.buffer);
  // Si file-type no detecta nada (ej. texto plano — CSV/TXT no tienen firma binaria que
  // sniffear), se cae al mimetype declarado solo como último recurso posible, no por
  // confiar en el cliente sino porque no hay otra señal disponible.
  const esImagenReal = real.mime
    ? real.mime.startsWith(IMAGE_MIME_PREFIX)
    : file.mimetype.startsWith(IMAGE_MIME_PREFIX);

  if (esImagenReal) {
    return [
      {
        nombre,
        tipo: "imagen",
        mime: real.mime ?? file.mimetype,
        base64: file.buffer.toString("base64"),
      },
    ];
  }

  // .doc/.xls viejos son ambiguos por firma (ver COMPOUND_BINARY_MIME) — ahí sí se
  // respeta la extensión declarada, es la única excepción documentada.
  const extReal =
    real.mime === COMPOUND_BINARY_MIME || !real.ext
      ? extDeclarada
      : `.${real.ext}`;

  // .eml no tiene firma binaria fiable en file-type; en prod el navegador a veces
  // manda message/rfc822. La extensión/MIME declarados mandan sobre un sniff falso.
  const esCorreo =
    extDeclarada === ".eml" ||
    extReal === ".eml" ||
    file.mimetype === "message/rfc822" ||
    file.mimetype === "application/eml";

  if (esCorreo) {
    return extractFromEml(file.buffer, nombre);
  }

  const contenido = await extraerContenidoPorTipo(
    file.buffer,
    extReal,
    extDeclarada,
  );
  return [{ nombre, ...contenido } as ArchivoExtraido];
}

export async function extractFiles(
  files: Array<{ originalname: string; mimetype: string; buffer: Buffer }> | undefined,
): Promise<ArchivoExtraido[]> {
  const resultados = await Promise.all((files ?? []).map(extractFile));
  return resultados.flat();
}
