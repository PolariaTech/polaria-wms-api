import { Injectable } from '@nestjs/common';
import {
  EstadoOrdenTrabajo,
  EstadoSlot,
  EstadoTarea,
  Prisma,
  TipoLineaOt,
  TipoMovimiento,
  TipoOrdenTrabajo,
  TipoTarea,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  CONTADOR_CLAVE_ORDEN_TRABAJO,
  TIPO_REFERENCIA_ORDEN_TRABAJO,
  formatCodigoOrdenTrabajo,
} from '../constants/operations.constants';
import type {
  CreateOrdenTrabajoInput,
  EjecutarOrdenTrabajoInput,
  FlujoOrdenTrabajo,
  OrdenTrabajoResponse,
} from '../interfaces/operations.interfaces';

const ordenInclude = {
  lineas: { orderBy: { idLineaOrdenTrabajo: 'asc' as const } },
} satisfies Prisma.OrdenTrabajoInclude;

export type OrdenWithLineas = Prisma.OrdenTrabajoGetPayload<{
  include: typeof ordenInclude;
}>;

const FLUJO_TIPO_OT: Record<FlujoOrdenTrabajo, TipoOrdenTrabajo> = {
  a_bodega: TipoOrdenTrabajo.reabasto,
  a_salida: TipoOrdenTrabajo.picking,
  revisar: TipoOrdenTrabajo.conteo,
};

const FLUJO_TIPO_TAREA: Record<FlujoOrdenTrabajo, TipoTarea> = {
  a_bodega: TipoTarea.movimiento,
  a_salida: TipoTarea.despacho,
  revisar: TipoTarea.revision,
};

const FLUJO_TITULO: Record<FlujoOrdenTrabajo, string> = {
  a_bodega: 'A bodega',
  a_salida: 'A salida',
  revisar: 'Revisar',
};

function parseTipoFlujo(observaciones: string | null): FlujoOrdenTrabajo | null {
  if (!observaciones?.startsWith('flujo:')) {
    return null;
  }
  const value = observaciones.slice('flujo:'.length).split('|')[0]?.trim();
  if (value === 'a_bodega' || value === 'a_salida' || value === 'revisar') {
    return value;
  }
  return null;
}

function buildObservaciones(
  tipoFlujo: FlujoOrdenTrabajo,
  observaciones?: string,
): string {
  const base = `flujo:${tipoFlujo}`;
  const extra = observaciones?.trim();
  return extra ? `${base}|${extra}` : base;
}

@Injectable()
export class OrdenTrabajoRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(where: Prisma.OrdenTrabajoWhereInput): Promise<OrdenWithLineas[]> {
    return this.prisma.ordenTrabajo.findMany({
      where,
      include: ordenInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(idOrdenTrabajo: string): Promise<OrdenWithLineas | null> {
    return this.prisma.ordenTrabajo.findUnique({
      where: { idOrdenTrabajo },
      include: ordenInclude,
    });
  }

  async create(
    input: CreateOrdenTrabajoInput,
    idSolicitante: string,
  ): Promise<OrdenWithLineas> {
    return this.prisma.$transaction(async (tx) => {
      const codigo = await this.nextCodigo(tx, input.codigoCuenta, input.idBodega);
      const tipo = FLUJO_TIPO_OT[input.tipoFlujo];

      const orden = await tx.ordenTrabajo.create({
        data: {
          codigoCuenta: input.codigoCuenta,
          idBodega: input.idBodega,
          codigo,
          tipo,
          estado: EstadoOrdenTrabajo.planificada,
          idSolicitante,
          idAsignado: input.idAsignado ?? null,
          idLote: input.idLote ?? null,
          idUbicacionOrigen: input.idUbicacionOrigen ?? null,
          idUbicacionDestino: input.idUbicacionDestino ?? null,
          observaciones: buildObservaciones(input.tipoFlujo, input.observaciones),
          ...(input.idProducto && input.cantidad != null
            ? {
                lineas: {
                  create: {
                    idProducto: input.idProducto,
                    idUbicacion: input.idUbicacionOrigen ?? null,
                    tipoLinea: TipoLineaOt.salida,
                    cantidad: new Prisma.Decimal(input.cantidad),
                  },
                },
              }
            : {}),
        },
        include: ordenInclude,
      });

      await tx.tareaCola.create({
        data: {
          codigoCuenta: input.codigoCuenta,
          idBodega: input.idBodega,
          tipo: FLUJO_TIPO_TAREA[input.tipoFlujo],
          estado: EstadoTarea.pendiente,
          idAsignado: input.idAsignado ?? null,
          idOrdenTrabajo: orden.idOrdenTrabajo,
          titulo: `${FLUJO_TITULO[input.tipoFlujo]} · ${codigo}`,
          descripcion: input.observaciones?.trim() || null,
        },
      });

      return orden;
    });
  }

  async ejecutar(
    orden: OrdenWithLineas,
    input: EjecutarOrdenTrabajoInput,
    idUsuario: string,
  ): Promise<OrdenWithLineas> {
    const tipoFlujo = parseTipoFlujo(orden.observaciones);

    return this.prisma.$transaction(async (tx) => {
      if (
        input.idWarehouseState &&
        tipoFlujo &&
        tipoFlujo !== 'revisar' &&
        orden.idUbicacionDestino
      ) {
        const ws = await tx.warehouseState.findUnique({
          where: { idWarehouseState: input.idWarehouseState },
        });

        if (!ws) {
          throw new Error('WAREHOUSE_STATE_NOT_FOUND');
        }

        if (input.version != null && ws.version !== input.version) {
          throw new Error('WAREHOUSE_STATE_VERSION_CONFLICT');
        }

        const cantidadMover = ws.cantidad;
        const destinoExistente = await tx.warehouseState.findFirst({
          where: {
            idUbicacion: orden.idUbicacionDestino,
            idProducto: ws.idProducto,
            idLote: ws.idLote,
          },
        });

        if (destinoExistente) {
          await tx.warehouseState.update({
            where: { idWarehouseState: destinoExistente.idWarehouseState },
            data: {
              cantidad: destinoExistente.cantidad.add(cantidadMover),
              version: { increment: 1 },
            },
          });
        } else {
          await tx.warehouseState.create({
            data: {
              codigoCuenta: ws.codigoCuenta,
              idBodega: ws.idBodega,
              idUbicacion: orden.idUbicacionDestino,
              idProducto: ws.idProducto,
              idLote: ws.idLote,
              cantidad: cantidadMover,
              temperatura: ws.temperatura,
            },
          });
        }

        if (ws.cantidad.eq(cantidadMover)) {
          await tx.warehouseState.delete({
            where: { idWarehouseState: ws.idWarehouseState },
          });
        } else {
          await tx.warehouseState.update({
            where: { idWarehouseState: ws.idWarehouseState },
            data: {
              cantidad: ws.cantidad.sub(cantidadMover),
              version: { increment: 1 },
            },
          });
        }

        await tx.movimientoInventario.create({
          data: {
            codigoCuenta: orden.codigoCuenta,
            idBodega: orden.idBodega,
            idUbicacionOrigen: ws.idUbicacion,
            idUbicacionDestino: orden.idUbicacionDestino,
            idProducto: ws.idProducto,
            idLote: ws.idLote,
            cantidad: cantidadMover,
            tipoMovimiento: TipoMovimiento.transferencia,
            idUsuario,
            idReferencia: orden.idOrdenTrabajo,
            tipoReferencia: TIPO_REFERENCIA_ORDEN_TRABAJO,
          },
        });

        await tx.ubicacion.update({
          where: { idUbicacion: orden.idUbicacionDestino },
          data: { estadoSlot: EstadoSlot.ocupado },
        });
      }

      await tx.tareaCola.updateMany({
        where: {
          idOrdenTrabajo: orden.idOrdenTrabajo,
          estado: { in: [EstadoTarea.pendiente, EstadoTarea.en_proceso] },
        },
        data: {
          estado: EstadoTarea.completada,
          idAsignado: idUsuario,
        },
      });

      return tx.ordenTrabajo.update({
        where: { idOrdenTrabajo: orden.idOrdenTrabajo },
        data: {
          estado: EstadoOrdenTrabajo.completada,
          idAsignado: idUsuario,
        },
        include: ordenInclude,
      });
    });
  }

  private async nextCodigo(
    tx: Prisma.TransactionClient,
    codigoCuenta: string,
    idBodega: string,
  ): Promise<string> {
    const existing = await tx.contador.findFirst({
      where: {
        codigoCuenta,
        idBodega,
        clave: CONTADOR_CLAVE_ORDEN_TRABAJO,
      },
    });

    if (existing) {
      const updated = await tx.contador.update({
        where: { idContador: existing.idContador },
        data: { valor: { increment: 1 } },
      });
      return formatCodigoOrdenTrabajo(updated.valor);
    }

    const created = await tx.contador.create({
      data: {
        codigoCuenta,
        idBodega,
        clave: CONTADOR_CLAVE_ORDEN_TRABAJO,
        valor: 1n,
      },
    });
    return formatCodigoOrdenTrabajo(created.valor);
  }

  toResponse(orden: OrdenWithLineas): OrdenTrabajoResponse {
    const tipoFlujo = parseTipoFlujo(orden.observaciones);
    const observacionesLimpia = orden.observaciones?.includes('|')
      ? orden.observaciones.split('|').slice(1).join('|') || null
      : tipoFlujo
        ? null
        : orden.observaciones;

    return {
      idOrdenTrabajo: orden.idOrdenTrabajo,
      codigoCuenta: orden.codigoCuenta,
      idBodega: orden.idBodega,
      codigo: orden.codigo,
      estado: orden.estado,
      tipo: orden.tipo,
      tipoFlujo,
      idAsignado: orden.idAsignado,
      idSolicitante: orden.idSolicitante,
      idLote: orden.idLote,
      idUbicacionOrigen: orden.idUbicacionOrigen,
      idUbicacionDestino: orden.idUbicacionDestino,
      idSolicitudProcesamiento: orden.idSolicitudProcesamiento,
      observaciones: observacionesLimpia,
      createdAt: orden.createdAt,
      updatedAt: orden.updatedAt,
      lineas: orden.lineas.map((linea) => ({
        idLineaOrdenTrabajo: linea.idLineaOrdenTrabajo,
        idProducto: linea.idProducto,
        idUbicacion: linea.idUbicacion,
        tipoLinea: linea.tipoLinea,
        cantidad: linea.cantidad.toString(),
      })),
    };
  }
}
