import type { BodegaTipo } from '../../../generated/prisma/client';

export interface BodegaDestinoRecord {
  idBodega: string;
  codigoCuenta: string;
  codigo: string;
  nombre: string;
  tipo: BodegaTipo;
  capacidadSlots: number | null;
  estaActiva: boolean;
}

export interface BodegaDestinoResponse {
  idBodega: string;
  codigoCuenta: string;
  codigo: string;
  nombre: string;
  tipo: BodegaTipo;
  capacidadSlots: number | null;
  slotsLibres: number;
}
