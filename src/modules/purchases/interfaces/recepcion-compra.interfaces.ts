export interface RecepcionLineaInput {
  idLineaOrdenCompra: string;
  cantidadRecibida: number;
  temperaturaRegistrada?: number;
}

export interface RecepcionLineaAdicionalInput {
  idProducto: string;
  cantidadRecibida: number;
  temperaturaRegistrada?: number;
  tituloSnapshot?: string;
}

export interface CerrarRecepcionInput {
  codigoCuenta: string;
  idBodega: string;
  idOrdenCompra: string;
  lineas: RecepcionLineaInput[];
  lineasAdicionales?: RecepcionLineaAdicionalInput[];
  idUbicacionIngreso?: string;
  notas?: string;
}

export interface ListRecepcionesFilters {
  idBodega?: string;
  idOrdenCompra?: string;
}

export interface RecepcionLineaResponse {
  idLineaRecepcion: string;
  idLineaOrdenCompra: string | null;
  idProducto: string | null;
  cantidadRecibida: string;
  temperaturaRegistrada: string | null;
  esAdicional: boolean;
  tituloSnapshot: string | null;
}

export interface RecepcionCompraResponse {
  idRecepcion: string;
  codigoCuenta: string;
  idBodega: string;
  idOrdenCompra: string;
  sinDiferencias: boolean;
  notas: string | null;
  cerradaAt: Date;
  cerradaPor: string;
  createdAt: Date;
  lineas: RecepcionLineaResponse[];
  estadoOrdenCompra: string;
}
