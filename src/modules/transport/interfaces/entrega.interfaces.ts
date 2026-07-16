export interface LineaEntregaInput {
  idLineaOrdenVenta: string;
  cantidadEntregada: number;
}

export interface RegistrarEntregaInput {
  codigoCuenta: string;
  idBodega: string;
  idViaje: string;
  idGuia: string;
  idOrdenVenta: string;
  entregaConforme: boolean;
  descripcionIncidencia?: string | null;
  evidenciaFotoUrl: string;
  evidenciaFirmaUrl: string;
  lineas: LineaEntregaInput[];
  idUsuario: string;
}

export interface RegistrarEntregaResponse {
  idViaje: string;
  codigoViaje: string;
  idGuia: string;
  resultado: 'ok' | 'no_ok';
  estadoViaje: string;
  estadoVenta: string;
}
