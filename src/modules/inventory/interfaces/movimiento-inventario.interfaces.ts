export interface MovimientoInventarioResponse {
  idMovimientoInventario: string;
  codigoCuenta: string;
  idBodega: string;
  idUbicacionOrigen: string | null;
  idUbicacionDestino: string | null;
  idProducto: string;
  idLote: string | null;
  cantidad: string;
  tipoMovimiento: string;
  idUsuario: string;
  idReferencia: string | null;
  tipoReferencia: string | null;
  createdAt: Date;
}

export interface ListMovimientosInventarioFilters {
  idBodega: string;
  idProducto?: string;
  idUbicacion?: string;
  tipoMovimiento?: string;
  idReferencia?: string;
}
