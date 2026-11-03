/**
 * REQ-239: en los correos de BirchStreet el remitente real (quien hizo el pedido) viene en
 * el cuerpo, bajo «Sent By:», y en el PDF, en el bloque «Sent From» (campo Email). El
 * «CONTACTO:» del PDF es el correo de facturación, no el operativo, y no debe usarse.
 */

const CORREO = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const CORREO_GENERICO_BIRCHSTREET = /@birchstreet\.net$/i;
/** Líneas que se miran debajo de «Sent By:» (nombre, depto., hotel y correo). */
const LINEAS_BAJO_SENT_BY = 8;
const BLOQUE_SENT_FROM =
  /Sent\s*From\s*:[\s\S]{0,400}?E-?mail\s*:\s*([^\s,;]+@[^\s,;]+)/i;

function esUtil(correo: string | null | undefined): correo is string {
  return !!correo && !CORREO_GENERICO_BIRCHSTREET.test(correo);
}

function correoBajoSentBy(texto: string): string | null {
  const lineas = texto.split('\n');
  const inicio = lineas.findIndex((l) => /^\s*Sent\s*By\s*:/i.test(l));
  if (inicio < 0) return null;
  const ventana = lineas.slice(inicio, inicio + LINEAS_BAJO_SENT_BY + 1);
  for (const linea of ventana) {
    const correo = CORREO.exec(linea)?.[0];
    if (esUtil(correo)) return correo;
  }
  return null;
}

export function extractCorreoRemitenteBirchstreet(
  texto: string | null | undefined,
): string | null {
  const raw = (texto ?? '').replace(/\r\n/g, '\n');
  if (!raw.trim()) return null;
  const delPdf = BLOQUE_SENT_FROM.exec(raw)?.[1]?.trim();
  return correoBajoSentBy(raw) ?? (esUtil(delPdf) ? delPdf : null);
}
