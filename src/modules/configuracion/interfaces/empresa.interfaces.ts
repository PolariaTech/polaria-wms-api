export interface UpdateEmpresaResult {
  codigoEmpresa: string;
  razonSocial: string;
  telefono: string | null;
  estaActiva: boolean;
}

export interface UpdateEmpresaData {
  razonSocial?: string;
  telefono?: string | null;
  estaActiva?: boolean;
}
