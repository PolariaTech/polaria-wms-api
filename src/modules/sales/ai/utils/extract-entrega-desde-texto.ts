import * as chrono from "chrono-node";

export type EntregaExtraidaTexto = {
  /** YYYY-MM-DD si se pudo resolver. */
  fechaIso: string | null;
  /** Frase candidata de fecha (para resolverFechaEntrega / UI). */
  fechaFrase: string | null;
  /** HH:MM 24h */
  horarioDesde: string | null;
  /** HH:MM 24h */
  horarioHasta: string | null;
};

const MESES: Record<string, number> = {
  enero: 1,
  february: 2,
  febrero: 2,
  marzo: 3,
  march: 3,
  abril: 4,
  april: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  june: 6,
  julio: 7,
  july: 7,
  agosto: 8,
  august: 8,
  septiembre: 9,
  setiembre: 9,
  september: 9,
  octubre: 10,
  october: 10,
  noviembre: 11,
  november: 11,
  diciembre: 12,
  december: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatIso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function quitarAcentos(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Normaliza "6:00 am", "14h", "7" → HH:MM. */
export function normalizarHoraAHhMm(
  hora: string,
  minuto: string | undefined,
  ampm: string | undefined,
): string | null {
  let h = Number(hora);
  const m = minuto != null && minuto !== "" ? Number(minuto) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 24 || m < 0 || m > 59) {
    return null;
  }
  const mer = (ampm ?? "").replace(/\./g, "").toLowerCase();
  if (mer === "pm" || mer === "p") {
    if (h < 12) h += 12;
  } else if (mer === "am" || mer === "a") {
    if (h === 12) h = 0;
  }
  if (h === 24) h = 0;
  if (h > 23) return null;
  return `${pad2(h)}:${pad2(m)}`;
}

function parseFechaNumerica(raw: string): string | null {
  const text = raw.trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/);
  if (dmy) {
    const dd = pad2(Number(dmy[1]));
    const mm = pad2(Number(dmy[2]));
    const yearRaw = dmy[3]!;
    const yyyy =
      yearRaw.length === 2
        ? Number(yearRaw) >= 70
          ? `19${yearRaw}`
          : `20${yearRaw}`
        : yearRaw;
    const candidate = `${yyyy}-${mm}-${dd}`;
    const parsed = new Date(`${candidate}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return candidate;
  }
  return null;
}

function parseFechaConMesNombre(frase: string, hoyISO: string): string | null {
  const norm = quitarAcentos(frase);
  const m = norm.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(?:de\s+)?(\d{4}))?\b/i,
  );
  if (!m) return null;
  const day = Number(m[1]);
  const mes = MESES[m[2]!.toLowerCase()];
  if (!mes || day < 1 || day > 31) return null;
  const year = m[3] ? Number(m[3]) : Number(hoyISO.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  const iso = `${year}-${pad2(mes)}-${pad2(day)}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return iso;
}

const ENTREGA_CTX =
  /(?:fecha\s*(?:de\s*)?(?:entrega|envio|env[ií]o)|entregar?\s+(?:el|para|el\s+d[ií]a)|delivery\s*date|deliver(?:y)?\s+(?:on|by)|para\s+el|el\s+d[ií]a)\b/i;

/**
 * Busca la mejor frase de fecha cerca de contexto de entrega, o la primera
 * fecha explícita del cuerpo (dd/mm, ISO, "N de mes").
 */
export function extraerFechaFraseDesdeTexto(texto: string): string | null {
  const raw = texto.replace(/\r\n/g, "\n");
  if (!raw.trim()) return null;

  const patterns: RegExp[] = [
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/g,
    /\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(?:de\s+)?\d{4})?\b/gi,
  ];

  type Hit = { frase: string; index: number; score: number };
  const hits: Hit[] = [];

  for (const re of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(raw)) != null) {
      const frase = match[0]!.trim();
      const index = match.index;
      const before = raw.slice(Math.max(0, index - 48), index);
      const score = ENTREGA_CTX.test(before) ? 100 : 10;
      hits.push({ frase, index, score });
    }
  }

  // Relativas cortas solo con contexto de entrega / pedido.
  const relativas =
    /\b(?:pasado\s+ma[nñ]ana|ma[nñ]ana|hoy|el\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)|en\s+\d+\s+d[ií]as?)\b/gi;
  let rel: RegExpExecArray | null;
  while ((rel = relativas.exec(raw)) != null) {
    const before = raw.slice(Math.max(0, rel.index - 48), rel.index);
    if (
      ENTREGA_CTX.test(before) ||
      /pedido|entrega|enviar|favor\s+de/i.test(before)
    ) {
      hits.push({ frase: rel[0]!, index: rel.index, score: 80 });
    }
  }

  if (hits.length === 0) return null;
  hits.sort((a, b) => b.score - a.score || a.index - b.index);
  return hits[0]!.frase;
}

function resolveFechaIso(
  frase: string | null,
  hoyISO: string,
): string | null {
  if (!frase?.trim()) return null;
  const numerica = parseFechaNumerica(frase);
  if (numerica) return numerica;
  const conMes = parseFechaConMesNombre(frase, hoyISO);
  if (conMes) return conMes;

  const referencia = new Date(`${hoyISO}T12:00:00Z`);
  const resultado = chrono.es.parseDate(frase, referencia, {
    forwardDate: true,
  });
  return resultado ? formatIso(resultado) : null;
}

/**
 * Extrae ventana de horas del cuerpo (rangos o hora única de entrega).
 */
export function extraerHorarioDesdeTexto(texto: string): {
  horarioDesde: string | null;
  horarioHasta: string | null;
} {
  const raw = texto.replace(/\r\n/g, "\n");
  if (!raw.trim()) return { horarioDesde: null, horarioHasta: null };

  type RangeHit = {
    desde: string;
    hasta: string;
    score: number;
    index: number;
  };
  const ranges: RangeHit[] = [];

  const dedicatedRanges: Array<{ re: RegExp; score: number }> = [
    {
      score: 100,
      re: /(?:ventana(?:\s+de\s+recepci[oó]n)?|horario(?:\s+de\s+(?:entrega|recepci[oó]n))?|delivery\s+(?:window|hours?)|hora(?:rio)?\s+de\s+entrega)[^\n\d]{0,48}(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?\s*[-–—/]\s*(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/i,
    },
    {
      score: 95,
      re: /(?:entre|de)\s+(?:las?\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?\s+(?:y|a|to|until|hasta)\s+(?:las?\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/i,
    },
    {
      score: 80,
      re: /(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)\s*[-–—]\s*(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)/i,
    },
    {
      score: 70,
      re: /(\d{1,2})(?:[:.](\d{2}))?\s*(?:h(?:rs?)?)?\s*[-–—]\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:h(?:rs?)?)?\b/i,
    },
  ];

  for (const { re, score } of dedicatedRanges) {
    const m = re.exec(raw);
    if (!m) continue;
    const desde = normalizarHoraAHhMm(m[1]!, m[2], m[3]);
    const hasta = normalizarHoraAHhMm(m[4]!, m[5], m[6]);
    if (desde && hasta) {
      ranges.push({ desde, hasta, score, index: m.index });
    }
  }

  if (ranges.length > 0) {
    ranges.sort((a, b) => b.score - a.score || a.index - b.index);
    return {
      horarioDesde: ranges[0]!.desde,
      horarioHasta: ranges[0]!.hasta,
    };
  }

  // Single delivery hour.
  const singleRes: Array<{ re: RegExp; score: number }> = [
    {
      score: 100,
      re: /(?:hora\s+de\s+entrega|entregar?\s+a\s+las?|delivery\s+time|a\s+partir\s+de\s+las?|desde\s+las?)[^\n\d]{0,24}(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/i,
    },
    {
      score: 60,
      re: /\b(?:a\s+las?)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)\b/i,
    },
  ];

  type SingleHit = { hora: string; score: number; index: number };
  const singles: SingleHit[] = [];
  for (const { re, score } of singleRes) {
    const m = re.exec(raw);
    if (!m) continue;
    const hora = normalizarHoraAHhMm(m[1]!, m[2], m[3]);
    if (hora) singles.push({ hora, score, index: m.index });
  }

  if (singles.length > 0) {
    singles.sort((a, b) => b.score - a.score || a.index - b.index);
    return { horarioDesde: singles[0]!.hora, horarioHasta: null };
  }

  return { horarioDesde: null, horarioHasta: null };
}

/**
 * Extracción determinista de fecha/hora de entrega desde el cuerpo del correo/PDF.
 * Complementa a Mateo cuando deja fecha/horario en null.
 */
export function extractEntregaDesdeTexto(
  texto: string | null | undefined,
  hoyISO: string,
): EntregaExtraidaTexto {
  const raw = (texto ?? "").trim();
  if (!raw) {
    return {
      fechaIso: null,
      fechaFrase: null,
      horarioDesde: null,
      horarioHasta: null,
    };
  }

  const fechaFrase = extraerFechaFraseDesdeTexto(raw);
  const fechaIso = resolveFechaIso(fechaFrase, hoyISO);
  const { horarioDesde, horarioHasta } = extraerHorarioDesdeTexto(raw);

  return { fechaIso, fechaFrase, horarioDesde, horarioHasta };
}
