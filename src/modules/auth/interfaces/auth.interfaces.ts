import type { AuthFlow, AuthScope } from '../../../shared/constants/auth.constants';
import type { UsuarioWithRelations } from '../infrastructure/usuario.repository';

export interface UserPreview {
  idUsuario: string;
  nombre: string;
  username: string;
  idRol: string;
  nombreRol: string;
  codigoEmpresa: string | null;
  codigoCuenta: string | null;
}

export interface PreloginResponse {
  ok: true;
  requiresPassword: true;
  flow: AuthFlow;
  userPreview: UserPreview;
}

export interface SessionContext {
  idUsuario: string;
  idRol: string;
  codigoEmpresa: string | null;
  codigoCuenta: string | null;
  scope: AuthScope;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  context: SessionContext;
}

export interface MeResponse {
  idUsuario: string;
  idAuth: string;
  nombre: string;
  username: string;
  correo: string;
  idRol: string;
  nombreRol: string;
  nivelRol: string;
  codigoEmpresa: string | null;
  razonSocialEmpresa: string | null;
  codigoCuenta: string | null;
  nombreComercialCuenta: string | null;
  scope: AuthScope;
  idBodegas: string[];
}

export interface ValidatedUserContext {
  usuario: UsuarioWithRelations;
  flow: AuthFlow;
  scope: AuthScope;
}

export interface MateoHandoffResponse {
  code: string;
  expiresIn: number;
}

export interface MateoExchangeUser {
  idUsuario: string;
  username: string;
  nombre: string;
  correo: string;
  nombreRol: string;
  codigoEmpresa: string | null;
  codigoCuenta: string | null;
  scope: AuthScope;
}

export interface MateoExchangeResponse {
  accessToken: string;
  refreshToken: string;
  user: MateoExchangeUser;
}
