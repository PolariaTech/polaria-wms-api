/**
 * Tipos que el ingreso (texto + archivos) todavía usa. La lectura del correo ya no pasa por
 * n8n: `GmailCorreosClient` habla con el buzón compartido (REQ-317).
 */
export interface CorreoN8nAdjunto {
  nombre: string;
  mimeType: string;
  base64: string;
}

export interface CorreoN8nCompleto {
  asunto: string;
  de: string;
  para: string;
  fecha: string | null;
  texto: string;
  html: string;
  adjuntos: CorreoN8nAdjunto[];
}
