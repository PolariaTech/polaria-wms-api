import type { EstadoOrdenVenta } from '../../../generated/prisma/client';

export interface OrdenVentaEmitirResponse {
  idOrdenVenta: string;
  venta: string;
  cuenta: string;
  comprador: string;
  productos: string;
  cantidadKg: number;
  total: number;
  estado: EstadoOrdenVenta;
  fecha: string;
  destino: string;
}

export interface StockAllocation {
  idWarehouseState: string;
  idUbicacion: string;
  idLote: string | null;
  idProducto: string;
  cantidad: number;
}
