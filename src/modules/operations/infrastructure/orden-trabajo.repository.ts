import { Injectable } from '@nestjs/common';
import {
  EstadoOrdenTrabajo,
  EstadoOrdenVenta,
  EstadoSlot,
  EstadoTarea,
  Prisma,
  TipoMovimiento,
  TipoOrdenTrabajo,
  TipoTarea,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
import { assertWarehouseStateLockForMove } from '../../inventory/utils/assert-warehouse-state-lock.util';
import { seleccionarWarehouseStateFefo } from '../../inventory/utils/fefo-warehouse-state.util';
import { syncUbicacionEstadoSlot } from '../../inventory/utils/sync-ubicacion-estado-slot.util';
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
  a_procesamiento: TipoOrdenTrabajo.transformacion,
};

const FLUJO_TIPO_TAREA: Record<FlujoOrdenTrabajo, TipoTarea> = {
  a_bodega: TipoTarea.movimiento,
  a_salida: TipoTarea.despacho,
  revisar: TipoTarea.revision,
  bodega_a_bodega: TipoTarea.movimiento,
  a_procesamiento: TipoTarea.procesamiento,
};

const FLUJO_TITULO: Record<FlujoOrdenTrabajo, string> = {
  a_bodega: 'A bodega',
  a_salida: 'A salida',
  revisar: 'Revisar',
  bodega_a_bodega: 'Bodega a bodega',
  a_procesamiento: 'Procesamiento',
};

@Injectable()
export class OrdenTrabajoRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schemaLocator: TenantSchemaLocator,
  ) {}

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
    const schema = this.schemaLocator.assertSafeSchemaIdent(
      this.prisma.getActiveSchemaName() ?? 'public',
    );
    const searchPath =
      schema === 'public'
        ? 'public,mateo_support'
        : `${schema},public,mateo_support`;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('search_path', $1, true)`,
        searchPath,
      );
      return this.createInTransaction(tx, input, idSolicitante, {
        registrarSalidaOv,
        schemaName: schema,
      });
    });
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    input: CreateOrdenTrabajoInput,
    idSolicitante: string,
    opciones?: CreateOrdenTrabajoOpciones,
  ): Promise<OrdenWithLineas> {
    const schema = this.schemaLocator.assertSafeSchemaIdent(
      opciones?.schemaName ?? this.prisma.getActiveSchemaName() ?? 'public',
    );

    const codigo = await this.nextCodigo(
      tx,
      schema,
      input.codigoCuenta,
      input.idBodega,
    );
    const tipo = FLUJO_TIPO_OT[input.tipoFlujo];
    const observaciones = buildObservacionesFlujo(
      input.tipoFlujo,
      input.observaciones,
    );

    const createdRows = await tx.$queryRawUnsafe<
      Array<{
        idOrdenTrabajo: string;
        codigoCuenta: string;
        idBodega: string;
        codigo: string;
        estado: EstadoOrdenTrabajo;
        tipo: TipoOrdenTrabajo;
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
      }>
    >(
      `INSERT INTO ${schema}.orden_trabajo (
         codigo_cuenta,
         id_bodega,
         codigo,
         tipo,
         estado,
         id_solicitante,
         id_asignado,
         id_lote,
         id_ubicacion_origen,
         id_ubicacion_destino,
         id_orden_venta,
         observaciones
       ) VALUES (
         $1,
         $2::uuid,
         $3,
         $4,
         'planificada',
         $5::uuid,
         $6::uuid,
         $7::uuid,
         $8::uuid,
         $9::uuid,
         $10::uuid,
         $11
       )
       RETURNING
         id_orden_trabajo AS "idOrdenTrabajo",
         codigo_cuenta AS "codigoCuenta",
         id_bodega AS "idBodega",
         codigo,
         estado,
         tipo,
         id_asignado AS "idAsignado",
         id_solicitante AS "idSolicitante",
         id_lote AS "idLote",
         id_ubicacion_origen AS "idUbicacionOrigen",
         id_ubicacion_destino AS "idUbicacionDestino",
         id_solicitud_procesamiento AS "idSolicitudProcesamiento",
         id_orden_venta AS "idOrdenVenta",
         observaciones,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      input.codigoCuenta,
      input.idBodega,
      codigo,
      tipo,
      idSolicitante,
      input.idAsignado ?? null,
      input.idLote ?? null,
      input.idUbicacionOrigen ?? null,
      input.idUbicacionDestino ?? null,
      input.idOrdenVenta ?? null,
      observaciones,
    );

    const created = createdRows[0];
    if (!created) {
      throw new Error(`No se pudo insertar orden_trabajo en ${schema}`);
    }

    const lineas: OrdenWithLineas['lineas'] = [];
    if (input.idProducto && input.cantidad != null) {
      const lineaRows = await tx.$queryRawUnsafe<OrdenWithLineas['lineas']>(
        `INSERT INTO ${schema}.orden_trabajo_linea (
           id_orden_trabajo,
           id_producto,
           id_ubicacion,
           tipo_linea,
           cantidad
         ) VALUES (
           $1::uuid,
           $2::uuid,
           $3::uuid,
           'salida',
           $4::numeric
         )
         RETURNING
           id_linea_orden_trabajo AS "idLineaOrdenTrabajo",
           id_orden_trabajo AS "idOrdenTrabajo",
           id_producto AS "idProducto",
           id_ubicacion AS "idUbicacion",
           tipo_linea AS "tipoLinea",
           cantidad`,
        created.idOrdenTrabajo,
        input.idProducto,
        input.idUbicacionOrigen ?? null,
        input.cantidad,
      );
      lineas.push(...lineaRows);
    }

    await tx.$executeRawUnsafe(
      `INSERT INTO ${schema}.tarea_cola (
         codigo_cuenta,
         id_bodega,
         tipo,
         estado,
         id_asignado,
         id_orden_trabajo,
         titulo,
         descripcion
       ) VALUES (
         $1,
         $2::uuid,
         $3,
         'pendiente',
         $4::uuid,
         $5::uuid,
         $6,
         $7
       )`,
      input.codigoCuenta,
      input.idBodega,
      FLUJO_TIPO_TAREA[input.tipoFlujo],
      input.idAsignado ?? null,
      created.idOrdenTrabajo,
      `${FLUJO_TITULO[input.tipoFlujo]} · ${codigo}`,
      input.observaciones?.trim() || null,
    );

    const orden = { ...created, lineas } as OrdenWithLineas;

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
            tipoFlujo,
            idUsuario,
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

      if (!opciones?.skipCompletarTarea) {
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
      }

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
    tipoFlujo: FlujoOrdenTrabajo | null,
    idUsuario: string,
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

      assertWarehouseStateLockForMove(ws, idUsuario);
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

    const usarFefo =
      tipoFlujo === 'a_salida' || tipoFlujo === 'bodega_a_bodega';

    const candidatos = await tx.warehouseState.findMany({
      where,
      include: { lote: true },
      ...(usarFefo
        ? {
            orderBy: [
              { lote: { fechaVencimiento: 'asc' } },
              { updatedAt: 'asc' },
            ],
          }
        : {}),
    });

    if (candidatos.length === 0) {
      throw new Error('WAREHOUSE_STATE_NOT_FOUND');
    }

    let ws: WarehouseStateRow;

    if (candidatos.length > 1) {
      if (usarFefo) {
        const seleccionado = seleccionarWarehouseStateFefo(candidatos);
        if (!seleccionado) {
          throw new Error('WAREHOUSE_STATE_NOT_FOUND');
        }
        ws = seleccionado;
      } else {
        throw new Error('WAREHOUSE_STATE_AMBIGUOUS');
      }
    } else {
      ws = candidatos[0]!;
    }

    assertWarehouseStateLockForMove(ws, idUsuario);
    return ws;
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

    await syncUbicacionEstadoSlot(tx, idUbicacionDestino);
    await syncUbicacionEstadoSlot(tx, idUbicacionOrigen);

    return { idProducto: ws.idProducto, cantidad: cantidadMover };
  }

  private async nextCodigo(
    tx: Prisma.TransactionClient,
    schema: string,
    codigoCuenta: string,
    idBodega: string,
  ): Promise<string> {
    const rows = await tx.$queryRawUnsafe<Array<{ valor: bigint | string }>>(
      `INSERT INTO ${schema}.contador (codigo_cuenta, id_bodega, clave, valor)
       VALUES ($1, $2::uuid, $3, 1)
       ON CONFLICT (codigo_cuenta, id_bodega, clave)
       DO UPDATE SET
         valor = ${schema}.contador.valor + 1,
         updated_at = now()
       RETURNING valor`,
      codigoCuenta,
      idBodega,
      CONTADOR_CLAVE_ORDEN_TRABAJO,
    );

    const valor = rows[0]?.valor;
    if (valor == null) {
      throw new Error(`No se pudo obtener contador de OT en ${schema}`);
    }

    return formatCodigoOrdenTrabajo(
      typeof valor === 'bigint' ? valor : BigInt(valor),
    );
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
