export interface UpdateEmpresaResult {
  codigoEmpresa: string;
  razonSocial: string;
  telefono: string | null;
  estaActiva: boolean;
  schemaName?: string | null;
}

export interface UpdateEmpresaData {
  razonSocial?: string;
  telefono?: string | null;
  estaActiva?: boolean;
}

export interface CreateEmpresaData {
  codigoEmpresa: string;
  razonSocial: string;
  telefono?: string | null;
  idCreador?: string | null;
}

export interface CreateEmpresaResult {
  codigoEmpresa: string;
  razonSocial: string;
  telefono: string | null;
  estaActiva: boolean;
  schemaName: string;
}
