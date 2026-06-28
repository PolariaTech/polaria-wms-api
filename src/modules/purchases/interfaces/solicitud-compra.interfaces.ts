import type { EstadoSolicitudCompra } from '../../../generated/prisma/client';

export interface SolicitudCompraLineaInput {
  idProducto: string;
  cantidad: number;
}

export interface CreateSolicitudCompraInput {
  codigoCuenta: string;
  idBodega: string;
  idProveedor?: string;
  observaciones?: string;
  lineas: SolicitudCompraLineaInput[];
}

export interface UpdateSolicitudCompraInput {
  idProveedor?: string | null;
  observaciones?: string | null;
  lineas?: SolicitudCompraLineaInput[];
}

export interface ListSolicitudesFilters {
  idBodega?: string;
  estado?: EstadoSolicitudCompra;
  idProveedor?: string;
}

export interface SolicitudCompraLineaResponse {
  idLineaSolicitudCompra: string;
  idProducto: string;
  cantidad: string;
}

export interface SolicitudCompraResponse {
  idSolicitudCompra: string;
  codigoCuenta: string;
  idBodega: string;
  idProveedor: string | null;
  idOrdenCompra: string | null;
  codigo: string;
  estado: EstadoSolicitudCompra;
  idSolicitante: string;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
  lineas: SolicitudCompraLineaResponse[];
}
