export interface EmpresaFichaFiscal {
  rfc: string | null;
  regimenFiscal: string | null;
  codigoPostalExpedicion: string | null;
  nombreCuentaBancaria: string | null;
  banco: string | null;
  clabe: string | null;
  correoCobranza: string | null;
  serieFactura: string | null;
  logoPath: string | null;
}

export interface UpdateEmpresaResult extends EmpresaFichaFiscal {
  codigoEmpresa: string;
  razonSocial: string;
  telefono: string | null;
  estaActiva: boolean;
  schemaName?: string | null;
}

export interface UpdateEmpresaData extends Partial<EmpresaFichaFiscal> {
  razonSocial?: string;
  telefono?: string | null;
  estaActiva?: boolean;
}

export interface CreateEmpresaData extends Partial<EmpresaFichaFiscal> {
  codigoEmpresa: string;
  razonSocial: string;
  telefono?: string | null;
  idCreador?: string | null;
}

export interface CreateEmpresaResult extends EmpresaFichaFiscal {
  codigoEmpresa: string;
  razonSocial: string;
  telefono: string | null;
  estaActiva: boolean;
  schemaName: string;
}
