import { Injectable } from '@nestjs/common';
import {
  EstadoOrdenTrabajo,
  EstadoOrdenVenta,
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
import {
  cancelarOtsPendientesOv,
  esUbicacionZonaSalida,
  marcarOvEnPreparacion,
  registrarDespachoOv,
} from '../../sales/utils/orden-venta-estado.util';
import type {
  CreateOrdenTrabajoInput,
  CreateOrdenTrabajoOpciones,
  EjecutarOrdenOpciones,
  EjecutarOrdenTrabajoInput,
  FlujoOrdenTrabajo,
  OrdenTrabajoResponse,
} from '../interfaces/operations.interfaces';
import {
  buildObservacionesFlujo,
  parseTipoFlujo,
} from '../utils/orden-trabajo-flujo.util';
import { resolveCantidadAMover } from '../utils/orden-trabajo-cantidad.util';

const ordenInclude = {
  lineas: { orderBy: { idLineaOrdenTrabajo: 'asc' as const } },
} satisfies Prisma.OrdenTrabajoInclude;

export type OrdenWithLineas = Prisma.OrdenTrabajoGetPayload<{
  include: typeof ordenInclude;
}>;

type WarehouseStateRow = Prisma.WarehouseStateGetPayload<object>;

const FLUJO_TIPO_OT: Record<FlujoOrdenTrabajo, TipoOrdenTrabajo> = {
  a_bodega: TipoOrdenTrabajo.reabasto,
  a_salida: TipoOrdenTrabajo.picking,
  revisar: TipoOrdenTrabajo.conteo,
  bodega_a_bodega: TipoOrdenTrabajo.reabasto,
};

const FLUJO_TIPO_TAREA: Record<FlujoOrdenTrabajo, TipoTarea> = {
  a_bodega: TipoTarea.movimiento,
  a_salida: TipoTarea.despacho,
  revisar: TipoTarea.revision,
  bodega_a_bodega: TipoTarea.movimiento,
};

const FLUJO_TITULO: Record<FlujoOrdenTrabajo, string> = {
  a_bodega: 'A bodega',
  a_salida: 'A salida',
  revisar: 'Revisar',
  bodega_a_bodega: 'Bodega a bodega',
};

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
    const registrarSalidaOv =
      input.tipoFlujo === 'a_salida' && Boolean(input.idOrdenVenta);

    return this.prisma.$transaction((tx) =>
      this.createInTransaction(tx, input, idSolicitante, {
        registrarSalidaOv,
      }),
    );
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    input: CreateOrdenTrabajoInput,
    idSolicitante: string,
    opciones?: CreateOrdenTrabajoOpciones,
  ): Promise<OrdenWithLineas> {
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
        idOrdenVenta: input.idOrdenVenta ?? null,
        observaciones: buildObservacionesFlujo(
          input.tipoFlujo,
          input.observaciones,
        ),
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

    if (opciones?.registrarSalidaOv && input.idOrdenVenta) {
      await marcarOvEnPreparacion(tx, input.idOrdenVenta);
      await cancelarOtsPendientesOv(
        tx,
        input.idOrdenVenta,
        orden.idOrdenTrabajo,
      );
    }

    return orden;
  }

  async ejecutar(
    orden: OrdenWithLineas,
    input: EjecutarOrdenTrabajoInput,
    idUsuario: string,
    opciones?: EjecutarOrdenOpciones,
  ): Promise<OrdenWithLineas> {
    const tipoFlujo = parseTipoFlujo(orden.observaciones);
    const autoResolver =
      opciones?.autoResolverStock === true ||
      (!input.idWarehouseState && opciones?.autoResolverStock !== false);

    return this.prisma.$transaction(async (tx) => {
      if (tipoFlujo && tipoFlujo !== 'revisar') {
        const idUbicacionDestino = await this.resolveUbicacionDestino(
          tx,
          orden,
          tipoFlujo,
        );

        if (idUbicacionDestino) {
          const ws = await this.resolveWarehouseStateOrigen(
            tx,
            orden,
            input.idWarehouseState,
            input.version,
            autoResolver,
          );

          const transferencia = await this.transferirStock(
            tx,
            ws,
            idUbicacionDestino,
            orden,
            idUsuario,
          );

          if (
            orden.idOrdenVenta &&
            tipoFlujo === 'a_salida' &&
            (await esUbicacionZonaSalida(tx, idUbicacionDestino))
          ) {
            const nuevoEstadoOv = await registrarDespachoOv(
              tx,
              orden.idOrdenVenta,
              [
                {
                  idProducto: transferencia.idProducto,
                  cantidad: transferencia.cantidad,
                },
              ],
            );

            if (nuevoEstadoOv === EstadoOrdenVenta.despachada) {
              await cancelarOtsPendientesOv(
                tx,
                orden.idOrdenVenta,
                orden.idOrdenTrabajo,
              );
            }
          }
        }
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

  private async resolveUbicacionDestino(
    tx: Prisma.TransactionClient,
    orden: OrdenWithLineas,
    tipoFlujo: FlujoOrdenTrabajo,
  ): Promise<string | null> {
    if (orden.idUbicacionDestino) {
      return orden.idUbicacionDestino;
    }

    if (tipoFlujo === 'revisar') {
      return null;
    }

    if (tipoFlujo !== 'a_salida') {
      throw new Error('UBICACION_DESTINO_REQUIRED');
    }

    const slot = await tx.ubicacion.findFirst({
      where: {
        idBodega: orden.idBodega,
        codigoCuenta: orden.codigoCuenta,
        estaActiva: true,
        estadoSlot: EstadoSlot.libre,
        tipoUbicacion: { esPicking: true },
      },
      orderBy: { codigo: 'asc' },
    });

    if (!slot) {
      throw new Error('UBICACION_DESTINO_NOT_FOUND');
    }

    return slot.idUbicacion;
  }

  private async resolveWarehouseStateOrigen(
    tx: Prisma.TransactionClient,
    orden: OrdenWithLineas,
    idWarehouseStateExplicito: string | undefined,
    version: number | undefined,
    autoResolver: boolean,
  ): Promise<WarehouseStateRow> {
    if (idWarehouseStateExplicito) {
      const ws = await tx.warehouseState.findUnique({
        where: { idWarehouseState: idWarehouseStateExplicito },
      });

      if (!ws) {
        throw new Error('WAREHOUSE_STATE_NOT_FOUND');
      }

      if (version != null && ws.version !== version) {
        throw new Error('WAREHOUSE_STATE_VERSION_CONFLICT');
      }

      return ws;
    }

    if (!autoResolver) {
      throw new Error('WAREHOUSE_STATE_NOT_FOUND');
    }

    const idUbicacionOrigen =
      orden.idUbicacionOrigen ?? orden.lineas[0]?.idUbicacion ?? null;

    if (!idUbicacionOrigen) {
      throw new Error('WAREHOUSE_STATE_NOT_FOUND');
    }

    const where: Prisma.WarehouseStateWhereInput = {
      idBodega: orden.idBodega,
      codigoCuenta: orden.codigoCuenta,
      idUbicacion: idUbicacionOrigen,
      cantidad: { gt: 0 },
    };

    if (orden.idLote) {
      where.idLote = orden.idLote;
    }

    const primeraLinea = orden.lineas[0];
    if (primeraLinea?.idProducto) {
      where.idProducto = primeraLinea.idProducto;
    }

    const candidatos = await tx.warehouseState.findMany({ where });

    if (candidatos.length === 0) {
      throw new Error('WAREHOUSE_STATE_NOT_FOUND');
    }

    if (candidatos.length > 1) {
      throw new Error('WAREHOUSE_STATE_AMBIGUOUS');
    }

    return candidatos[0]!;
  }

  private async transferirStock(
    tx: Prisma.TransactionClient,
    ws: WarehouseStateRow,
    idUbicacionDestino: string,
    orden: OrdenWithLineas,
    idUsuario: string,
  ): Promise<{ idProducto: string; cantidad: Prisma.Decimal }> {
    const cantidadSolicitada = resolveCantidadAMover(orden.lineas);
    const cantidadMover = cantidadSolicitada ?? ws.cantidad;

    if (cantidadMover.lte(0)) {
      throw new Error('CANTIDAD_INVALIDA');
    }

    if (cantidadMover.gt(ws.cantidad)) {
      throw new Error('CANTIDAD_INSUFICIENTE_EN_SLOT');
    }

    const destinoExistente = await tx.warehouseState.findFirst({
      where: {
        idUbicacion: idUbicacionDestino,
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
          idUbicacion: idUbicacionDestino,
          idProducto: ws.idProducto,
          idLote: ws.idLote,
          cantidad: cantidadMover,
          temperatura: ws.temperatura,
        },
      });
    }

    const idUbicacionOrigen = ws.idUbicacion;
    const nuevaCantidad = ws.cantidad.sub(cantidadMover);
    const nuevaReservada = ws.cantidadReservada.gt(cantidadMover)
      ? ws.cantidadReservada.sub(cantidadMover)
      : new Prisma.Decimal(0);

    if (nuevaCantidad.lte(0)) {
      await tx.warehouseState.delete({
        where: { idWarehouseState: ws.idWarehouseState },
      });
    } else {
      await tx.warehouseState.update({
        where: { idWarehouseState: ws.idWarehouseState },
        data: {
          cantidad: nuevaCantidad,
          cantidadReservada: nuevaReservada,
          version: { increment: 1 },
        },
      });
    }

    await tx.movimientoInventario.create({
      data: {
        codigoCuenta: orden.codigoCuenta,
        idBodega: orden.idBodega,
        idUbicacionOrigen,
        idUbicacionDestino,
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
      where: { idUbicacion: idUbicacionDestino },
      data: { estadoSlot: EstadoSlot.ocupado },
    });

    const stockRestanteOrigen = await tx.warehouseState.count({
      where: { idUbicacion: idUbicacionOrigen },
    });

    if (stockRestanteOrigen === 0) {
      await tx.ubicacion.update({
        where: { idUbicacion: idUbicacionOrigen },
        data: { estadoSlot: EstadoSlot.libre },
      });
    }

    return { idProducto: ws.idProducto, cantidad: cantidadMover };
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
      idOrdenVenta: orden.idOrdenVenta,
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
