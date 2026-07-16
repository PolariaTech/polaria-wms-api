export interface CrearPaqueteDespachoInput {
  codigoCuenta: string;
  idBodega: string;
  idCamion: string;
  idOrdenesVenta: string[];
  idUsuario: string;
}

export interface GuiaPaqueteDespachoResponse {
  idGuia: string;
  codigo: string;
  idOrdenVenta: string;
  codigoVenta: string;
}

export interface PaqueteDespachoResponse {
  idViaje: string;
  codigoViaje: string;
  idCamion: string;
  placaCamion: string;
  guias: GuiaPaqueteDespachoResponse[];
}
