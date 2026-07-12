import type { EstadoProcesamiento } from '../../../generated/prisma/client';

export interface SolicitudProcesamientoResponse {
  idSolicitudProcesamiento: string;
  codigoCuenta: string;
  idBodega: string;
  codigo: string;
  idCliente: string | null;
  idProductoPrimario: string;
  idProductoSecundario: string;
  idSolicitante: string;
  idProcesador: string | null;
  estado: EstadoProcesamiento;
  kilosPrimario: string;
  kilosSecundario: string | null;
  kilosMerma: string | null;
  sobranteKg: string | null;
  reglaConversionCantidadPrimario: string | null;
  reglaConversionUnidadesSecundario: string | null;
  perdidaProcesamientoPct: string | null;
  estimadoUnidadesSecundario: string | null;
  kgPrimarioDescontado: string | null;
  cierreDesdeProcesador: boolean;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSolicitudProcesamientoInput {
  codigoCuenta: string;
  idBodega: string;
  idCliente?: string;
  idProductoPrimario: string;
  idProductoSecundario: string;
  kilosPrimario: number;
  reglaConversionCantidadPrimario?: number;
  reglaConversionUnidadesSecundario?: number;
  perdidaProcesamientoPct?: number;
  observaciones?: string;
}

export interface CerrarSolicitudProcesamientoInput {
  codigoCuenta: string;
  idBodega: string;
  kilosSecundario?: number;
  kilosMerma: number;
  sobranteKg?: number;
}
