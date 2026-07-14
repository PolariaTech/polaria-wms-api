import { Injectable } from '@nestjs/common';
import {
  EstadoOrdenVenta,
  EstadoSlot,
  Prisma,
  TipoMovimiento,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { OrdenTrabajoRepository } from '../../operations/infrastructure/orden-trabajo.repository';
import type { FlujoOrdenTrabajo } from '../../operations/interfaces/operations.interfaces';
import { TIPO_REFERENCIA_ORDEN_VENTA } from '../constants/orden-venta.constants';
import type {
  OrdenVentaEmitirResponse,
  StockAllocation,
} from '../interfaces/orden-venta.interfaces';

const ordenInclude = {
  lineas: {
    orderBy: { idLineaOrdenVenta: 'asc' as const },
    include: {
      producto: {
        select: {
          idProducto: true,
          sku: true,
          descripcion: true,
          estaActivo: true,
          metadatosCatalogo: true,
        },
      },
    },
  },
  comprador: { select: { idComprador: true, nombre: true, estaActivo: true } },
  cliente: { select: { idCliente: true, nombre: true, estaActivo: true } },
  bodega: {
    select: {
      idBodega: true,
      nombre: true,
      estaActiva: true,
      codigoCuenta: true,
    },
  },
  bodegaDestino: { select: { idBodega: true, nombre: true, estaActiva: true } },
} satisfies Prisma.OrdenVentaInclude;

export type OrdenVentaWithRelations = Prisma.OrdenVentaGetPayload<{
  include: typeof ordenInclude;
}>;

@Injectable()
export class OrdenVentaRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordenTrabajoRepository: OrdenTrabajoRepository,
  ) {}

  findById(idOrdenVenta: string): Promise<OrdenVentaWithRelations | null> {
    return this.prisma.ordenVenta.findUnique({
      where: { idOrdenVenta },
      include: ordenInclude,
    });
  }

  list(where: Prisma.OrdenVentaWhereInput): Promise<OrdenVentaWithRelations[]> {
    return this.prisma.ordenVenta.findMany({
      where,
      include: ordenInclude,
      orderBy: { fechaPedido: 'desc' },
    });
  }

  async emitir(
    orden: OrdenVentaWithRelations,
    idUsuario: string,
  ): Promise<OrdenVentaEmitirResponse> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.ordenVenta.updateMany({
        where: {
          idOrdenVenta: orden.idOrdenVenta,
          estado: EstadoOrdenVenta.borrador,
        },
        data: { estado: EstadoOrdenVenta.confirmada },
      });

      if (locked.count === 0) {
        throw new Error('OV_ESTADO_INVALIDO');
      }

      const tipoFlujo = this.resolveTipoFlujo(orden);
      const idUbicacionDestino = await this.resolveUbicacionDestino(
        tx,
        orden,
        tipoFlujo,
      );

      const allocations: StockAllocation[] = [];

      for (const linea of orden.lineas) {
        const pendiente = linea.cantidadPedida;
        const chunks = await this.allocateFifo(
          tx,
          orden.codigoCuenta,
          orden.idBodega,
          linea.idProducto,
          pendiente,
        );
        allocations.push(...chunks);

        for (const chunk of chunks) {
          await tx.warehouseState.update({
            where: { idWarehouseState: chunk.idWarehouseState },
            data: {
              cantidadReservada: {
                increment: new Prisma.Decimal(chunk.cantidad),
              },
              version: { increment: 1 },
            },
          });

          await tx.movimientoInventario.create({
            data: {
              codigoCuenta: orden.codigoCuenta,
              idBodega: orden.idBodega,
              idUbicacionOrigen: chunk.idUbicacion,
              idUbicacionDestino: chunk.idUbicacion,
              idProducto: chunk.idProducto,
              idLote: chunk.idLote,
              cantidad: new Prisma.Decimal(chunk.cantidad),
              tipoMovimiento: TipoMovimiento.reserva,
              idUsuario,
              idReferencia: orden.idOrdenVenta,
              tipoReferencia: TIPO_REFERENCIA_ORDEN_VENTA,
            },
          });

          const observacionesOt = `OV ${orden.codigo}${
            orden.comprador ? ` · ${orden.comprador.nombre}` : ''
          }`;

          await this.ordenTrabajoRepository.createInTransaction(
            tx,
            {
              codigoCuenta: orden.codigoCuenta,
              idBodega: orden.idBodega,
              tipoFlujo,
              idUbicacionOrigen: chunk.idUbicacion,
              idUbicacionDestino,
              idLote: chunk.idLote ?? undefined,
              idProducto: linea.idProducto,
              cantidad: chunk.cantidad,
              idOrdenVenta: orden.idOrdenVenta,
              observaciones: observacionesOt,
            },
            idUsuario,
          );
        }
      }

      const updated = await tx.ordenVenta.findUniqueOrThrow({
        where: { idOrdenVenta: orden.idOrdenVenta },
        include: ordenInclude,
      });

      return this.toEmitirResponse(updated);
    });
  }

  private resolveTipoFlujo(orden: OrdenVentaWithRelations): FlujoOrdenTrabajo {
    if (orden.idBodegaDestino && orden.idBodegaDestino !== orden.idBodega) {
      return 'bodega_a_bodega';
    }
    return 'a_salida';
  }

  private async resolveUbicacionDestino(
    tx: Prisma.TransactionClient,
    orden: OrdenVentaWithRelations,
    tipoFlujo: FlujoOrdenTrabajo,
  ): Promise<string> {
    if (tipoFlujo === 'bodega_a_bodega' && orden.idBodegaDestino) {
      const slot = await tx.ubicacion.findFirst({
        where: {
          idBodega: orden.idBodegaDestino,
          estaActiva: true,
          estadoSlot: EstadoSlot.libre,
          tipoUbicacion: { esAlmacenamiento: true },
        },
        orderBy: { codigo: 'asc' },
      });

      if (!slot) {
        throw new Error('UBICACION_DESTINO_NOT_FOUND');
      }

      return slot.idUbicacion;
    }

    const slotSalida = await tx.ubicacion.findFirst({
      where: {
        idBodega: orden.idBodega,
        codigoCuenta: orden.codigoCuenta,
        estaActiva: true,
        estadoSlot: EstadoSlot.libre,
        tipoUbicacion: { esPicking: true },
      },
      orderBy: { codigo: 'asc' },
    });

    if (!slotSalida) {
      throw new Error('UBICACION_DESTINO_NOT_FOUND');
    }

    return slotSalida.idUbicacion;
  }

  private async allocateFifo(
    tx: Prisma.TransactionClient,
    codigoCuenta: string,
    idBodega: string,
    idProducto: string,
    cantidadRequerida: Prisma.Decimal,
  ): Promise<StockAllocation[]> {
    const rows = await tx.warehouseState.findMany({
      where: {
        codigoCuenta,
        idBodega,
        idProducto,
        ubicacion: {
          estaActiva: true,
          tipoUbicacion: { esAlmacenamiento: true },
        },
      },
      include: { lote: true },
      orderBy: [{ lote: { fechaVencimiento: 'asc' } }, { updatedAt: 'asc' }],
    });

    let restante = cantidadRequerida;
    const allocations: StockAllocation[] = [];

    for (const row of rows) {
      const disponible = row.cantidad.sub(row.cantidadReservada);
      if (disponible.lte(0)) {
        continue;
      }

      const tomar = disponible.lte(restante) ? disponible : restante;
      if (tomar.lte(0)) {
        continue;
      }

      allocations.push({
        idWarehouseState: row.idWarehouseState,
        idUbicacion: row.idUbicacion,
        idLote: row.idLote,
        idProducto: row.idProducto,
        cantidad: tomar.toNumber(),
      });

      restante = restante.sub(tomar);
      if (restante.lte(0)) {
        break;
      }
    }

    if (restante.gt(0)) {
      const producto = await tx.producto.findUnique({
        where: { idProducto },
        select: { descripcion: true, sku: true },
      });
      const nombre = producto?.descripcion ?? producto?.sku ?? idProducto;
      const disponibleTotal = cantidadRequerida.sub(restante).toNumber();
      throw new Error(`STOCK_INSUFICIENTE|${nombre}|${disponibleTotal}`);
    }

    return allocations;
  }

  async getDisponibleProducto(
    codigoCuenta: string,
    idBodega: string,
    idProducto: string,
  ): Promise<Prisma.Decimal> {
    const rows = await this.prisma.warehouseState.findMany({
      where: {
        codigoCuenta,
        idBodega,
        idProducto,
        ubicacion: {
          estaActiva: true,
          tipoUbicacion: { esAlmacenamiento: true },
        },
      },
      select: { cantidad: true, cantidadReservada: true },
    });

    return rows.reduce(
      (sum, row) => sum.add(row.cantidad.sub(row.cantidadReservada)),
      new Prisma.Decimal(0),
    );
  }

  toEmitirResponse(orden: OrdenVentaWithRelations): OrdenVentaEmitirResponse {
    const cantidadKg = orden.lineas.reduce(
      (sum, linea) => sum.add(linea.cantidadPedida),
      new Prisma.Decimal(0),
    );

    let total = new Prisma.Decimal(0);
    for (const linea of orden.lineas) {
      const precio = this.extractPrecio(linea.producto.metadatosCatalogo);
      total = total.add(precio.mul(linea.cantidadPedida));
    }

    const productosLabel =
      orden.lineas.length === 1
        ? '1 producto'
        : `${orden.lineas.length} productos`;

    const destino =
      orden.bodegaDestino?.nombre ?? orden.bodega.nombre ?? 'Salida interna';

    return {
      idOrdenVenta: orden.idOrdenVenta,
      venta: orden.codigo,
      cuenta: orden.codigoCuenta,
      comprador: orden.comprador?.nombre ?? orden.cliente.nombre,
      productos: productosLabel,
      cantidadKg: cantidadKg.toNumber(),
      total: total.toNumber(),
      estado: orden.estado,
      fecha: orden.fechaPedido.toISOString(),
      destino,
    };
  }

  private extractPrecio(metadatos: Prisma.JsonValue | null): Prisma.Decimal {
    if (
      !metadatos ||
      typeof metadatos !== 'object' ||
      Array.isArray(metadatos)
    ) {
      return new Prisma.Decimal(0);
    }

    const precio = (metadatos as { precio?: unknown }).precio;
    if (typeof precio === 'number' && Number.isFinite(precio)) {
      return new Prisma.Decimal(precio);
    }

    if (typeof precio === 'string' && precio.trim()) {
      return new Prisma.Decimal(precio);
    }

    return new Prisma.Decimal(0);
  }
}
