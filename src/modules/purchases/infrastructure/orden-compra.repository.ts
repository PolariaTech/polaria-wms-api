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
  CODIGO_OC_PREFIX,
  formatCodigoOrden,
  parseCodigoOrdenSecuencia,
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
    return this.runOrdenCompraTransaction(async (tx) => {
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
    return this.runOrdenCompraTransaction(async (tx) => {
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

  updateDestino(
    idOrdenCompra: string,
    data: {
      destinoTipo: DestinoTipo;
      idBodega: string;
      fechaEntregaEstimada?: Date | null;
    },
  ): Promise<OrdenWithLineas> {
    return this.prisma.ordenCompra.update({
      where: { idOrdenCompra },
      data: {
        destinoTipo: data.destinoTipo,
        idBodega: data.idBodega,
        ...(data.fechaEntregaEstimada !== undefined
          ? { fechaEntregaEstimada: data.fechaEntregaEstimada }
          : {}),
      },
      include: ordenInclude,
    });
  }

  private async runOrdenCompraTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.prisma.$transaction(fn);
      } catch (error) {
        if (
          attempt < maxAttempts &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error('No se pudo asignar un código de orden de compra único');
  }

  private async maxSecuenciaOrdenExistente(
    tx: Prisma.TransactionClient,
    codigoCuenta: string,
  ): Promise<bigint> {
    const ordenes = await tx.ordenCompra.findMany({
      where: {
        codigoCuenta,
        codigo: { startsWith: CODIGO_OC_PREFIX },
      },
      select: { codigo: true },
    });

    let max = 0n;
    for (const orden of ordenes) {
      const secuencia = parseCodigoOrdenSecuencia(orden.codigo);
      if (secuencia !== null && secuencia > max) {
        max = secuencia;
      }
    }

    return max;
  }

  private async ensureContadorOrden(
    tx: Prisma.TransactionClient,
    codigoCuenta: string,
    maxExistente: bigint,
  ) {
    const existing = await tx.contador.findFirst({
      where: {
        codigoCuenta,
        idBodega: null,
        clave: CONTADOR_CLAVE_ORDEN_COMPRA,
      },
    });

    if (!existing) {
      return tx.contador.create({
        data: {
          codigoCuenta,
          clave: CONTADOR_CLAVE_ORDEN_COMPRA,
          valor: maxExistente,
        },
      });
    }

    if (existing.valor < maxExistente) {
      return tx.contador.update({
        where: { idContador: existing.idContador },
        data: { valor: maxExistente },
      });
    }

    return existing;
  }

  private async codigoOrdenDisponible(
    tx: Prisma.TransactionClient,
    codigoCuenta: string,
    codigo: string,
  ): Promise<boolean> {
    const orden = await tx.ordenCompra.findFirst({
      where: { codigoCuenta, codigo },
      select: { idOrdenCompra: true },
    });

    return orden === null;
  }

  private async nextCodigoOrden(
    tx: Prisma.TransactionClient,
    codigoCuenta: string,
  ): Promise<string> {
    const maxExistente = await this.maxSecuenciaOrdenExistente(
      tx,
      codigoCuenta,
    );
    const contador = await this.ensureContadorOrden(
      tx,
      codigoCuenta,
      maxExistente,
    );

    let updated = await tx.contador.update({
      where: { idContador: contador.idContador },
      data: { valor: { increment: 1 } },
    });

    let codigo = formatCodigoOrden(updated.valor);

    while (!(await this.codigoOrdenDisponible(tx, codigoCuenta, codigo))) {
      updated = await tx.contador.update({
        where: { idContador: contador.idContador },
        data: { valor: { increment: 1 } },
      });
      codigo = formatCodigoOrden(updated.valor);
    }

    return codigo;
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
