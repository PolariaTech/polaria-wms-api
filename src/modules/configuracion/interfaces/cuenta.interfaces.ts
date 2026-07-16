export interface UpdateCuentaResult {
  codigoCuenta: string;
  codigoEmpresa: string;
  nombreComercial: string;
  estaActiva: boolean;
}

export interface UpdateCuentaData {
  nombreComercial?: string;
  estaActiva?: boolean;
}

export interface CuentaRecord {
  codigoCuenta: string;
  codigoEmpresa: string;
  nombreComercial: string;
  estaActiva: boolean;
}

export interface BodegaAssignCandidate {
  idBodega: string;
  codigoCuenta: string;
  cuenta: { codigoEmpresa: string };
}
