export type MateoMensajeRol = 'user' | 'ai';
export type MateoMensajeTipo = 'text' | 'image';

export interface MateoMensajeDto {
  idMensaje: string;
  rol: MateoMensajeRol;
  tipo: MateoMensajeTipo;
  contenido: string;
  /** URL Cloudinary cuando tipo = image. */
  urlImagen: string | null;
  esError: boolean;
  createdAt: string;
}

export interface MateoConversacionListItem {
  idConversacion: string;
  titulo: string | null;
  codigoCuenta: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MateoConversacionDetalle extends MateoConversacionListItem {
  mensajes: MateoMensajeDto[];
}
