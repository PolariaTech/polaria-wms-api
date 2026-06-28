import { Injectable } from '@nestjs/common';
import {
  EstadoSolicitudCompra,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  CONTADOR_CLAVE_SOLICITUD_COMPRA,
  formatCodigoSolicitud,
} from '../constants/solicitud-compra.constants';
import type {
  CreateSolicitudCompraInput,
  ListSolicitudesFilters,
  SolicitudCompraLineaInput,
  SolicitudCompraResponse,
  UpdateSolicitudCompraInput,
} from '../interfaces/solicitud-compra.interfaces';

const solicitudInclude = {
  lineas: {
    orderBy: { idLineaSolicitudCompra: 'asc' as const },
  },
} satisfies Prisma.SolicitudCompraInclude;

type SolicitudWithLineas = Prisma.SolicitudCompraGetPayload<{
  include: typeof solicitudInclude;
}>;

@Injectable()
export class SolicitudCompraRepository {
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

  findById(idSolicitudCompra: string): Promise<SolicitudWithLineas | null> {
    return this.prisma.solicitudCompra.findUnique({
      where: { idSolicitudCompra },
      include: solicitudInclude,
    });
  }

  list(
    where: Prisma.SolicitudCompraWhereInput,
  ): Promise<SolicitudWithLineas[]> {
    return this.prisma.solicitudCompra.findMany({
      where,
      include: solicitudInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(
    input: CreateSolicitudCompraInput,
    idSolicitante: string,
  ): Promise<SolicitudWithLineas> {
    return this.prisma.$transaction(async (tx) => {
      const codigo = await this.nextCodigoSolicitud(tx, input.codigoCuenta);

      return tx.solicitudCompra.create({
        data: {
          codigoCuenta: input.codigoCuenta,
          idBodega: input.idBodega,
          idProveedor: input.idProveedor,
          codigo,
          idSolicitante,
          observaciones: input.observaciones?.trim() || null,
          lineas: {
            create: input.lineas.map((linea) => ({
              idProducto: linea.idProducto,
              cantidad: new Prisma.Decimal(linea.cantidad),
            })),
          },
        },
        include: solicitudInclude,
      });
    });
  }

  update(
    idSolicitudCompra: string,
    input: UpdateSolicitudCompraInput,
  ): Promise<SolicitudWithLineas> {
    return this.prisma.$transaction(async (tx) => {
      if (input.lineas) {
        await tx.solicitudCompraLinea.deleteMany({
          where: { idSolicitudCompra },
        });
      }

      return tx.solicitudCompra.update({
        where: { idSolicitudCompra },
        data: {
          ...(input.idProveedor !== undefined
            ? { idProveedor: input.idProveedor }
            : {}),
          ...(input.observaciones !== undefined
            ? { observaciones: input.observaciones?.trim() || null }
            : {}),
          ...(input.lineas
            ? {
                lineas: {
                  create: input.lineas.map((linea) => ({
                    idProducto: linea.idProducto,
                    cantidad: new Prisma.Decimal(linea.cantidad),
                  })),
                },
              }
            : {}),
        },
        include: solicitudInclude,
      });
    });
  }

  updateEstado(
    idSolicitudCompra: string,
    estado: EstadoSolicitudCompra,
    observaciones?: string | null,
  ): Promise<SolicitudWithLineas> {
    return this.prisma.solicitudCompra.update({
      where: { idSolicitudCompra },
      data: {
        estado,
        ...(observaciones !== undefined ? { observaciones } : {}),
      },
      include: solicitudInclude,
    });
  }

  private async nextCodigoSolicitud(
    tx: Prisma.TransactionClient,
    codigoCuenta: string,
  ): Promise<string> {
    const existing = await tx.contador.findFirst({
      where: {
        codigoCuenta,
        idBodega: null,
        clave: CONTADOR_CLAVE_SOLICITUD_COMPRA,
      },
    });

    if (existing) {
      const updated = await tx.contador.update({
        where: { idContador: existing.idContador },
        data: { valor: { increment: 1 } },
      });
      return formatCodigoSolicitud(updated.valor);
    }

    const created = await tx.contador.create({
      data: {
        codigoCuenta,
        clave: CONTADOR_CLAVE_SOLICITUD_COMPRA,
        valor: 1n,
      },
    });
    return formatCodigoSolicitud(created.valor);
  }

  toResponse(solicitud: SolicitudWithLineas): SolicitudCompraResponse {
    return {
      idSolicitudCompra: solicitud.idSolicitudCompra,
      codigoCuenta: solicitud.codigoCuenta,
      idBodega: solicitud.idBodega,
      idProveedor: solicitud.idProveedor,
      idOrdenCompra: solicitud.idOrdenCompra,
      codigo: solicitud.codigo,
      estado: solicitud.estado,
      idSolicitante: solicitud.idSolicitante,
      observaciones: solicitud.observaciones,
      createdAt: solicitud.createdAt,
      updatedAt: solicitud.updatedAt,
      lineas: solicitud.lineas.map((linea) => ({
        idLineaSolicitudCompra: linea.idLineaSolicitudCompra,
        idProducto: linea.idProducto,
        cantidad: linea.cantidad.toString(),
      })),
    };
  }
}
