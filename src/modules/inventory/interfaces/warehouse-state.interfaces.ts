export interface WarehouseStateResponse {
  idWarehouseState: string;
  codigoCuenta: string;
  idBodega: string;
  idUbicacion: string;
  idProducto: string;
  idLote: string | null;
  cantidad: string;
  cantidadReservada: string;
  temperatura: string | null;
  lockedBy: string | null;
  lockedAt: Date | null;
  version: number;
  updatedAt: Date;
}

export interface LockWarehouseStateInput {
  codigoCuenta: string;
  idBodega: string;
  expectedVersion?: number;
}

export interface ListWarehouseStateFilters {
  idBodega: string;
  idUbicacion?: string;
  idProducto?: string;
}
