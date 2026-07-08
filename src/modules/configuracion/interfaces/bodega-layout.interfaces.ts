export interface BootstrapLayoutResult {
  idBodega: string;
  codigoCuenta: string;
  capacidadSlots: number;
  tiposUbicacionCreados: number;
  zonasCreadas: number;
  ubicacionesCreadas: number;
}

export interface EnsureOperationalZonesResult {
  idBodega: string;
  codigoCuenta: string;
  tiposUbicacionCreados: number;
  zonasCreadas: number;
  ubicacionesIngresoCreadas: number;
  ubicacionesSalidaCreadas: number;
  ubicacionesProcesamientoCreadas: number;
}
