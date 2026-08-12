import type { RolNivel, WmsRol } from '../../generated/prisma/client';

export interface TenantContext {
  idUsuario: string;
  idRol: WmsRol;
  nivelRol: RolNivel;
  codigoEmpresa: string | null;
  codigoCuenta: string | null;
  /** Cuentas activas de la empresa del usuario (admin empresa sin cuenta fija). */
  codigosCuentaEmpresa: string[];
  idBodegas: string[];
  /** Schema Postgres emp_* (null = legacy en public). */
  schemaName: string | null;
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  supabaseUser?: { id: string };
  accessToken?: string;
  tenantContext?: TenantContext;
}
