import { Injectable } from '@nestjs/common';
import {
  DestinoTipo,
  EstadoOrdenCompra,
  EstadoSolicitudCompra,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  CONTADOR_CLAVE_ORDEN_COMPRA,
  formatCodigoOrden,
} from '../constants/orden-compra.constants';
import type {
  ConvertirSolicitudExtras,
  CreateOrdenCompraInput,
  OrdenCompraResponse,
} from '../interfaces/orden-compra.interfaces';

const ordenInclude = {
  lineas: {
    orderBy: { idLineaOrdenCompra: 'asc' as const },
  },
} satisfies Prisma.OrdenCompraInclude;

export type OrdenWithLineas = Prisma.OrdenCompraGetPayload<{
  include: typeof ordenInclude;
}>;

@Injectable()
export class OrdenCompraRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBodega(idBodega: string) {
    return this.prisma.bodega.findUnique({
      where: { idBodega },
      select: {
        idBodega: true,
        codigoCuenta: true,
        estaActiva: true,
      },
    });
  }

  findProveedor(idProveedor: string) {
    return this.prisma.proveedor.findUnique({
      where: { idProveedor },
      select: {
        idProveedor: true,
        codigoCuenta: true,
        estaActivo: true,
      },
    });
  }

  findProductos(ids: string[]) {
    return this.prisma.producto.findMany({
      where: { idProducto: { in: ids } },
      select: {
        idProducto: true,
        codigoCuenta: true,
        estaActivo: true,
      },
    });
  }

  findById(idOrdenCompra: string): Promise<OrdenWithLineas | null> {
    return this.prisma.ordenCompra.findUnique({
      where: { idOrdenCompra },
      include: ordenInclude,
    });
  }

  list(where: Prisma.OrdenCompraWhereInput): Promise<OrdenWithLineas[]> {
    return this.prisma.ordenCompra.findMany({
      where,
      include: ordenInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(
    input: CreateOrdenCompraInput,
    idCreador: string,
  ): Promise<OrdenWithLineas> {
    return this.prisma.$transaction(async (tx) => {
      const codigo = await this.nextCodigoOrden(tx, input.codigoCuenta);

      return tx.ordenCompra.create({
        data: {
          codigoCuenta: input.codigoCuenta,
          idBodega: input.idBodega,
          idProveedor: input.idProveedor,
          idSolicitudCompra: input.idSolicitudCompra ?? null,
          idCreador,
          codigo,
          fechaEntregaEstimada: input.fechaEntregaEstimada ?? null,
          destinoTipo: input.destinoTipo ?? DestinoTipo.interna,
          observaciones: input.observaciones?.trim() || null,
          lineas: {
            create: input.lineas.map((linea) => ({
              idProducto: linea.idProducto,
              cantidad: new Prisma.Decimal(linea.cantidad),
              precioUnitario: new Prisma.Decimal(linea.precioUnitario ?? 0),
            })),
          },
        },
        include: ordenInclude,
      });
    });
  }

  convertSolicitudToOrden(
    solicitud: {
      idSolicitudCompra: string;
      codigoCuenta: string;
      idBodega: string;
      idProveedor: string;
      observaciones: string | null;
      lineas: Array<{
        idProducto: string;
        cantidad: Prisma.Decimal;
      }>;
    },
    idCreador: string,
    extras?: ConvertirSolicitudExtras,
  ): Promise<OrdenWithLineas> {
    return this.prisma.$transaction(async (tx) => {
      const codigo = await this.nextCodigoOrden(tx, solicitud.codigoCuenta);

      const orden = await tx.ordenCompra.create({
        data: {
          codigoCuenta: solicitud.codigoCuenta,
          idBodega: solicitud.idBodega,
          idProveedor: solicitud.idProveedor,
          idSolicitudCompra: solicitud.idSolicitudCompra,
          idCreador,
          codigo,
          fechaEntregaEstimada: extras?.fechaEntregaEstimada ?? null,
          destinoTipo: extras?.destinoTipo ?? DestinoTipo.interna,
          observaciones:
            extras?.observaciones?.trim() ||
            solicitud.observaciones?.trim() ||
            null,
          lineas: {
            create: solicitud.lineas.map((linea) => ({
              idProducto: linea.idProducto,
              cantidad: linea.cantidad,
              precioUnitario: new Prisma.Decimal(0),
            })),
          },
        },
        include: ordenInclude,
      });

      await tx.solicitudCompra.update({
        where: { idSolicitudCompra: solicitud.idSolicitudCompra },
        data: {
          estado: EstadoSolicitudCompra.convertida,
          idOrdenCompra: orden.idOrdenCompra,
        },
      });

      return orden;
    });
  }

  updateEstado(
    idOrdenCompra: string,
    estado: EstadoOrdenCompra,
  ): Promise<OrdenWithLineas> {
    return this.prisma.ordenCompra.update({
      where: { idOrdenCompra },
      data: { estado },
      include: ordenInclude,
    });
  }

  private async nextCodigoOrden(
    tx: Prisma.TransactionClient,
    codigoCuenta: string,
  ): Promise<string> {
    const existing = await tx.contador.findFirst({
      where: {
        codigoCuenta,
        idBodega: null,
        clave: CONTADOR_CLAVE_ORDEN_COMPRA,
      },
    });

    if (existing) {
      const updated = await tx.contador.update({
        where: { idContador: existing.idContador },
        data: { valor: { increment: 1 } },
      });
      return formatCodigoOrden(updated.valor);
    }

    const created = await tx.contador.create({
      data: {
        codigoCuenta,
        clave: CONTADOR_CLAVE_ORDEN_COMPRA,
        valor: 1n,
      },
    });
    return formatCodigoOrden(created.valor);
  }

  toResponse(orden: OrdenWithLineas): OrdenCompraResponse {
    return {
      idOrdenCompra: orden.idOrdenCompra,
      codigoCuenta: orden.codigoCuenta,
      idBodega: orden.idBodega,
      idProveedor: orden.idProveedor,
      idSolicitudCompra: orden.idSolicitudCompra,
      idCreador: orden.idCreador,
      codigo: orden.codigo,
      estado: orden.estado,
      fechaEmision: orden.fechaEmision,
      fechaEntregaEstimada: orden.fechaEntregaEstimada,
      destinoTipo: orden.destinoTipo,
      observaciones: orden.observaciones,
      createdAt: orden.createdAt,
      updatedAt: orden.updatedAt,
      lineas: orden.lineas.map((linea) => ({
        idLineaOrdenCompra: linea.idLineaOrdenCompra,
        idProducto: linea.idProducto,
        cantidad: linea.cantidad.toString(),
        precioUnitario: linea.precioUnitario.toString(),
        cantidadRecibida: linea.cantidadRecibida.toString(),
      })),
    };
  }
}
