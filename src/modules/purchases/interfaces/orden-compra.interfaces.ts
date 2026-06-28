import type {
  DestinoTipo,
  EstadoOrdenCompra,
} from '../../../generated/prisma/client';

export interface OrdenCompraLineaInput {
  idProducto: string;
  cantidad: number;
  precioUnitario?: number;
}

export interface CreateOrdenCompraInput {
  codigoCuenta: string;
  idBodega: string;
  idProveedor: string;
  idSolicitudCompra?: string;
  fechaEntregaEstimada?: Date;
  destinoTipo?: DestinoTipo;
  observaciones?: string;
  lineas: OrdenCompraLineaInput[];
}

export interface ListOrdenesFilters {
  idBodega?: string;
  estado?: EstadoOrdenCompra;
  idProveedor?: string;
  idSolicitudCompra?: string;
}

export interface OrdenCompraLineaResponse {
  idLineaOrdenCompra: string;
  idProducto: string;
  cantidad: string;
  precioUnitario: string;
  cantidadRecibida: string;
}

export interface OrdenCompraResponse {
  idOrdenCompra: string;
  codigoCuenta: string;
  idBodega: string;
  idProveedor: string;
  idSolicitudCompra: string | null;
  idCreador: string | null;
  codigo: string;
  estado: EstadoOrdenCompra;
  fechaEmision: Date;
  fechaEntregaEstimada: Date | null;
  destinoTipo: DestinoTipo;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
  lineas: OrdenCompraLineaResponse[];
}

export interface ConvertirSolicitudExtras {
  fechaEntregaEstimada?: Date;
  destinoTipo?: DestinoTipo;
  observaciones?: string;
}
