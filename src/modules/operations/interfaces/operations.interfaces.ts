import type {
  EstadoAlerta,
  EstadoOrdenTrabajo,
  EstadoTarea,
  TipoAlerta,
  TipoOrdenTrabajo,
  TipoTarea,
} from '../../../generated/prisma/client';

export type FlujoOrdenTrabajo =
  | 'a_bodega'
  | 'a_salida'
  | 'revisar'
  | 'bodega_a_bodega'
  | 'a_procesamiento';

export interface OrdenTrabajoLineaResponse {
  idLineaOrdenTrabajo: string;
  idProducto: string;
  idUbicacion: string | null;
  tipoLinea: string;
  cantidad: string;
}

export interface OrdenTrabajoResponse {
  idOrdenTrabajo: string;
  codigoCuenta: string;
  idBodega: string;
  codigo: string;
  estado: EstadoOrdenTrabajo;
  tipo: TipoOrdenTrabajo;
  tipoFlujo: FlujoOrdenTrabajo | null;
  idAsignado: string | null;
  idSolicitante: string | null;
  idLote: string | null;
  idUbicacionOrigen: string | null;
  idUbicacionDestino: string | null;
  idSolicitudProcesamiento: string | null;
  idOrdenVenta: string | null;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
  lineas: OrdenTrabajoLineaResponse[];
}

export interface TareaColaResponse {
  idTarea: string;
  codigoCuenta: string;
  idBodega: string;
  tipo: TipoTarea;
  estado: EstadoTarea;
  idAsignado: string | null;
  idOrdenTrabajo: string | null;
  idSolicitudProcesamiento: string | null;
  titulo: string | null;
  descripcion: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertaOperativaResponse {
  idAlerta: string;
  codigoCuenta: string;
  idBodega: string;
  tipo: TipoAlerta;
  estado: EstadoAlerta;
  idUbicacion: string | null;
  idOrdenTrabajo: string | null;
  idResponsable: string | null;
  titulo: string;
  descripcion: string | null;
  motivoCierre: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  cerradaAt: Date | null;
}

export interface LlamadaOperativaResponse {
  idLlamada: string;
  codigoCuenta: string;
  idBodega: string;
  fromRol: string;
  message: string;
  idSolicitante: string;
  atendida: boolean;
  idAtendidoPor: string | null;
  createdAt: Date;
  atendidaAt: Date | null;
}

export interface OperarioDisponibleResponse {
  idUsuario: string;
  nombre: string;
  username: string;
  tareasPendientes: number;
  disponible: boolean;
  ultimoPing: string | null;
}

export interface CreateOrdenTrabajoInput {
  codigoCuenta: string;
  idBodega: string;
  tipoFlujo: FlujoOrdenTrabajo;
  idUbicacionOrigen?: string;
  idUbicacionDestino?: string;
  idLote?: string;
  idProducto?: string;
  cantidad?: number;
  idAsignado?: string;
  observaciones?: string;
  idOrdenVenta?: string;
}

export interface CreateOrdenTrabajoOpciones {
  /** Registro manual de salida por el jefe (transición OV + cancela OTs de emit). */
  registrarSalidaOv?: boolean;
}

export interface EjecutarOrdenTrabajoInput {
  codigoCuenta: string;
  idBodega: string;
  idWarehouseState?: string;
  version?: number;
}

export interface EjecutarOrdenOpciones {
  /** Si true, resuelve warehouse_state origen y destino sin input del cliente. */
  autoResolverStock?: boolean;
  /** Si true, no marca la tarea cola como completada (p. ej. flujo procesamiento). */
  skipCompletarTarea?: boolean;
}
