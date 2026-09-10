import { WmsRol } from '../../../generated/prisma/client';

export interface CreateUsuarioResponse {
  idUsuario: string;
  username: string;
  nombre: string;
  idRol: WmsRol;
  codigoCuenta: string | null;
  correo: string;
  telefono: string | null;
}

export interface UpdateUsuarioInput {
  nombre?: string;
  correo?: string;
  telefono?: string | null;
}
