/**
 * REQ-244 — SEADUST / KRYSTAL adjuntan OC mensuales junto al Excel o al pedido
 * del día (cuerpo). Mateo no debe tomar cantidades de esas OC mensuales.
 *
 * También concentra helpers de fecha (REQ-200) y selección de docs a leer,
 * para no hinchar openai-pedido / extract-entrega / pedido-ia (gate max-lines).
 */

import * as chrono from 'chrono-node';

export function catalogKeyPedido(nombre: string, codigo: string): string {
  return `${nombre} (${codigo})`;
}

export function tituloFromMetadatosPedido(metadatos: unknown): string | null {
  if (!metadatos || typeof metadatos !== 'object') return null;
  const titulo = (metadatos as { titulo?: unknown }).titulo;
  return typeof titulo === 'string' && titulo.trim() ? titulo.trim() : null;
}

const CLIENTES_OC_MENSUAL =
  /\b(seadust|krystal|cristal\s+grand|crystal\s+grand)\b/i;

// `_` cuenta como \w en JS: no usar solo \b (falla en OC_MENSUAL_….pdf).
const NOMBRE_OC_MENSUAL =
  /(?:^|[^a-z0-9])(mensual|monthly|oc[_\s.-]?mes(?:ual)?|orden[_\s.-]?mensual|pedido[_\s.-]?mensual|po[_\s.-]?mensual|compra[_\s.-]?del[_\s.-]?mes)(?=[^a-z0-9]|$)/i;

const CONTENIDO_OC_MENSUAL =
  /\b(orden\s+de\s+compra\s+mensual|pedido\s+mensual|oc\s+mensual|purchase\s+order\s+monthly|monthly\s+(?:purchase\s+)?order|vigencia\s+(?:del\s+)?mes|contrato\s+mensual)\b/i;

export type DocumentoOcMensual = {
  nombre: string;
  /** Texto extraído del adjunto (opcional; ayuda si el nombre no dice "mensual"). */
  contenido?: string | null;
};

export const LINEA_PROMPT_OC_MENSUAL =
  `- REQ-244 (SEADUST / KRYSTAL): estos hoteles suelen adjuntar una OC MENSUAL además del Excel o del pedido del día en el cuerpo. Las CANTIDADES y renglones salen SOLO del pedido del día (Excel/cuerpo). NUNCA copies cantidades ni líneas de un adjunto titulado o descrito como OC/pedido mensual. La OC mensual puede aportar el número de OC si el pedido del día no lo trae, pero no el surtido del mes.`;

export function esClienteOcMensualAdjunta(
  ...pistas: Array<string | null | undefined>
): boolean {
  const blob = pistas
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join('\n');
  if (!blob) return false;
  return CLIENTES_OC_MENSUAL.test(blob);
}

export function pareceOcMensualAdjunto(
  nombre: string,
  contenido?: string | null,
): boolean {
  const base = nombre.split(/→/).pop()?.trim() || nombre;
  if (NOMBRE_OC_MENSUAL.test(base)) return true;
  const snip = (contenido ?? '').slice(0, 4000);
  if (snip && CONTENIDO_OC_MENSUAL.test(snip)) return true;
  return false;
}

export function filtrarDocumentosOcMensual<T extends DocumentoOcMensual>(input: {
  pistasCliente: Array<string | null | undefined>;
  documentos: readonly T[];
  tieneContextoPedido: boolean;
}): { aLeer: T[]; ignorados: T[] } {
  const docs = [...input.documentos];
  if (docs.length === 0) return { aLeer: docs, ignorados: [] };

  const nombres = docs.map((d) => d.nombre).join('\n');
  if (!esClienteOcMensualAdjunta(...input.pistasCliente, nombres)) {
    return { aLeer: docs, ignorados: [] };
  }

  const ignorados: T[] = [];
  const operativos: T[] = [];
  for (const doc of docs) {
    if (pareceOcMensualAdjunto(doc.nombre, doc.contenido)) {
      ignorados.push(doc);
    } else {
      operativos.push(doc);
    }
  }

  if (ignorados.length === 0) return { aLeer: docs, ignorados: [] };

  const hayOtraFuente =
    operativos.length > 0 || input.tieneContextoPedido;
  if (!hayOtraFuente) {
    return { aLeer: docs, ignorados: [] };
  }

  return { aLeer: operativos, ignorados };
}

export type AdvertenciaOcMensual = {
  codigo: 'OC_MENSUAL_IGNORADA';
  documento: string;
  detalle: string;
};

type DocParaLeerOc = {
  nombre: string;
  archivos: Array<{ tipo?: string; contenido?: string }>;
  esTexto?: boolean;
};

/** REQ-244: filtra mensuales y arma la lista final a leer + advertencias. */
export function seleccionarDocsTrasOcMensual(input: {
  texto: string;
  contexto: ReadonlyArray<{ contenido: string }>;
  documentos: readonly DocParaLeerOc[];
}): {
  aLeer: Array<{ nombre: string; archivos: DocParaLeerOc['archivos']; esTexto?: boolean }>;
  advertencias: AdvertenciaOcMensual[];
} {
  const docs = input.documentos.map((documento) => ({
    ...documento,
    contenido: documento.archivos
      .filter((archivo) => archivo.tipo === 'texto')
      .map((archivo) => archivo.contenido ?? '')
      .join('\n'),
  }));
  const { aLeer: operativos, ignorados } = filtrarDocumentosOcMensual({
    pistasCliente: [
      input.texto,
      ...input.contexto.map((c) => c.contenido),
      ...input.documentos.map((d) => d.nombre),
    ],
    documentos: docs,
    tieneContextoPedido:
      input.texto.trim().length > 0 ||
      input.contexto.some((c) => c.contenido.trim().length > 40),
  });
  const advertencias: AdvertenciaOcMensual[] = ignorados.map((mensual) => ({
    codigo: 'OC_MENSUAL_IGNORADA',
    documento: mensual.nombre,
    detalle:
      'OC/pedido mensual de SEADUST/KRYSTAL: no se usan sus cantidades; el pedido del día sale del Excel o del cuerpo del correo.',
  }));
  const lean = (lista: typeof docs) =>
    lista.map(({ nombre, archivos, esTexto }) => ({ nombre, archivos, esTexto }));
  const mensaje = { nombre: 'mensaje', archivos: [] as DocParaLeerOc['archivos'], esTexto: false };
  if (operativos.length > 0) return { aLeer: lean(operativos), advertencias };
  if (ignorados.length > 0) return { aLeer: [mensaje], advertencias };
  if (input.documentos.length > 0) return { aLeer: lean(docs), advertencias };
  return { aLeer: [mensaje], advertencias };
}

function pad2Fecha(n: number): string {
  return String(n).padStart(2, '0');
}

function ymdIfValidFecha(
  year: number,
  month: number,
  day: number,
): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2Fecha(month)}-${pad2Fecha(day)}`;
}

/** REQ-200: DD/MM LatAm o MM/DD US; si una cae antes de hoyISO, preferir la futura. */
export function parseFechaNumerica(
  raw: string,
  hoyISO?: string,
): string | null {
  const text = raw.trim();
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return ymdIfValidFecha(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const slash = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/);
  if (!slash) return null;
  const first = Number(slash[1]);
  const second = Number(slash[2]);
  const yearRaw = slash[3]!;
  const year =
    yearRaw.length === 2
      ? Number(yearRaw) >= 70
        ? 1900 + Number(yearRaw)
        : 2000 + Number(yearRaw)
      : Number(yearRaw);
  const asDmy = ymdIfValidFecha(year, second, first);
  const asMdy = ymdIfValidFecha(year, first, second);
  if (asDmy && !asMdy) return asDmy;
  if (asMdy && !asDmy) return asMdy;
  if (asDmy && asMdy) {
    const hoy = hoyISO?.trim() ?? '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(hoy)) {
      const dmyPasada = asDmy < hoy;
      const mdyPasada = asMdy < hoy;
      if (dmyPasada && !mdyPasada) return asMdy;
      if (mdyPasada && !dmyPasada) return asDmy;
    }
    return asDmy;
  }
  return null;
}

export function formatISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function sumarDias(referencia: Date, dias: number): string {
  const d = new Date(referencia);
  d.setUTCDate(d.getUTCDate() + dias);
  return formatISO(d);
}

const SIN_ACENTOS: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  ñ: 'n',
};

function quitarAcentosFecha(s: string): string {
  return s.toLowerCase().replace(/[áéíóúñ]/g, (c) => SIN_ACENTOS[c] ?? c);
}

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

export function normalizarFechaConocida(
  fraseOriginal: string,
  referencia: Date,
): string | null {
  const frase = quitarAcentosFecha(fraseOriginal.trim());
  if (/^pasado\s+manana\b/.test(frase)) return sumarDias(referencia, 2);
  const enDias = frase.match(/^en\s+(\d+)\s+dias?\b/);
  if (enDias) return sumarDias(referencia, Number(enDias[1]));
  const proximaSemana = frase.match(
    /\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\s+de\s+la\s+(?:(proxima|otra|entrante)\s+semana|semana\s+(?:que\s+entra|siguiente|entrante))\b/,
  );
  if (proximaSemana) {
    const diaObjetivo = DIAS_SEMANA[proximaSemana[1]!];
    const diaHoy = referencia.getUTCDay();
    const inicioSemanaSiguiente = sumarDias(referencia, 7 - diaHoy);
    return sumarDias(
      new Date(`${inicioSemanaSiguiente}T12:00:00Z`),
      diaObjetivo!,
    );
  }
  return null;
}

/** REQ-200: numérico ambiguo antes de chrono.es (asume DD/MM). */
export function resolverFechaEntrega(
  fraseTexto: string | null,
  hoyISO: string,
): string | null {
  if (!fraseTexto) return null;
  const referencia = new Date(`${hoyISO}T12:00:00Z`);
  const conocida = normalizarFechaConocida(fraseTexto, referencia);
  if (conocida) return conocida;
  const numerica = parseFechaNumerica(fraseTexto, hoyISO);
  if (numerica) return numerica;
  const resultado = chrono.es.parseDate(fraseTexto, referencia, {
    forwardDate: true,
  });
  return resultado ? formatISO(resultado) : null;
}
