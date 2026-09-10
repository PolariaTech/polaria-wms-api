export interface UpdateCuentaResult {
  codigoCuenta: string;
  codigoEmpresa: string;
  nombreComercial: string;
  estaActiva: boolean;
  idBodegaDefault: string | null;
}

export interface UpdateCuentaData {
  nombreComercial?: string;
  estaActiva?: boolean;
  idBodegaDefault?: string | null;
}

export interface CuentaRecord {
  codigoCuenta: string;
  codigoEmpresa: string;
  nombreComercial: string;
  estaActiva: boolean;
  idBodegaDefault: string | null;
}

export interface BodegaAssignCandidate {
  idBodega: string;
  codigoCuenta: string;
  cuenta: { codigoEmpresa: string };
}
