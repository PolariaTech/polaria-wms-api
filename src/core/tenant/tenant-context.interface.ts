import type { RolNivel, WmsRol } from '../../generated/prisma/client';

export interface TenantContext {
  idUsuario: string;
  idRol: WmsRol;
  nivelRol: RolNivel;
  codigoEmpresa: string | null;
  codigoCuenta: string | null;
  idBodegas: string[];
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  supabaseUser?: { id: string };
  accessToken?: string;
  tenantContext?: TenantContext;
}
