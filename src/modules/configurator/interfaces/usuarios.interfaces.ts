import { WmsRol } from '../../../generated/prisma/client';

export interface CreateUsuarioResponse {
  idUsuario: string;
  username: string;
  nombre: string;
  idRol: WmsRol;
  codigoCuenta: string | null;
  correo: string;
  telefono: string | null;
  estaActivo?: boolean;
  accesoWms?: boolean;
  accesoMateo?: boolean;
}

export interface UpdateUsuarioInput {
  nombre?: string;
  correo?: string;
  telefono?: string | null;
  estaActivo?: boolean;
  accesoWms?: boolean;
  accesoMateo?: boolean;
}
