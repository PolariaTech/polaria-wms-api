import { Injectable } from '@nestjs/common';
import {
  EstadoOrdenCompra,
  Prisma,
  TipoMovimiento,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { syncUbicacionEstadoSlot } from '../../inventory/utils/sync-ubicacion-estado-slot.util';
import { TIPO_REFERENCIA_RECEPCION } from '../constants/recepcion-compra.constants';
import type {
  CerrarRecepcionInput,
  RecepcionCompraResponse,
  RecepcionLineaAdicionalInput,
} from '../interfaces/recepcion-compra.interfaces';

const recepcionInclude = {
  lineas: {
    orderBy: { idLineaRecepcion: 'asc' as const },
  },
  ordenCompra: {
    select: { estado: true },
  },
} satisfies Prisma.RecepcionCompraInclude;

export type RecepcionWithLineas = Prisma.RecepcionCompraGetPayload<{
  include: typeof recepcionInclude;
}>;

@Injectable()
export class RecepcionCompraRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByOrdenCompra(idOrdenCompra: string) {
    return this.prisma.recepcionCompra.findUnique({
      where: { idOrdenCompra },
      include: recepcionInclude,
    });
  }

  findById(idRecepcion: string): Promise<RecepcionWithLineas | null> {
    return this.prisma.recepcionCompra.findUnique({
      where: { idRecepcion },
      include: recepcionInclude,
    });
  }

  list(
    where: Prisma.RecepcionCompraWhereInput,
  ): Promise<RecepcionWithLineas[]> {
    return this.prisma.recepcionCompra.findMany({
      where,
      include: recepcionInclude,
      orderBy: { cerradaAt: 'desc' },
    });
  }

  findOrdenCompra(idOrdenCompra: string) {
    return this.prisma.ordenCompra.findUnique({
      where: { idOrdenCompra },
      include: {
        lineas: true,
        recepcion: { select: { idRecepcion: true } },
      },
    });
  }

  findUbicacionIngreso(idUbicacion: string, idBodega: string) {
    return this.prisma.ubicacion.findFirst({
      where: {
        idUbicacion,
        idBodega,
        estaActiva: true,
        tipoUbicacion: { esRecepcion: true },
      },
      select: {
        idUbicacion: true,
        idBodega: true,
        codigoCuenta: true,
      },
    });
  }

  findNextUbicacionIngresoLibre(idBodega: string) {
    return this.prisma.ubicacion.findFirst({
      where: {
        idBodega,
        estaActiva: true,
        estadoSlot: 'libre',
        tipoUbicacion: { esRecepcion: true },
        warehouseStates: { none: {} },
      },
      orderBy: { codigo: 'asc' },
      select: {
        idUbicacion: true,
        idBodega: true,
        codigoCuenta: true,
      },
    });
  }

  countUbicacionesIngreso(idBodega: string) {
    return this.prisma.ubicacion.count({
      where: {
        idBodega,
        estaActiva: true,
        tipoUbicacion: { esRecepcion: true },
      },
    });
  }

  findProductosRangoTemperatura(ids: string[]): Promise<
    Array<{
      idProducto: string;
      sku: string;
      rangoTemperaturaMin: Prisma.Decimal | null;
      rangoTemperaturaMax: Prisma.Decimal | null;
    }>
  > {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.producto.findMany({
      where: { idProducto: { in: ids } },
      select: {
        idProducto: true,
        sku: true,
        rangoTemperaturaMin: true,
        rangoTemperaturaMax: true,
      },
    });
  }

  cerrarRecepcion(
    input: CerrarRecepcionInput,
    idUsuario: string,
    sinDiferencias: boolean,
    nuevoEstadoOrden: EstadoOrdenCompra,
    lineasActualizadas: Array<{
      idLineaOrdenCompra: string;
      cantidadRecibida: Prisma.Decimal;
    }>,
    ingresoInventario?: {
      idUbicacionIngreso: string;
      entradas: Array<{
        idProducto: string;
        cantidad: Prisma.Decimal;
        temperatura?: Prisma.Decimal;
      }>;
    },
  ): Promise<RecepcionWithLineas> {
    return this.prisma.$transaction(async (tx) => {
      const recepcion = await tx.recepcionCompra.create({
        data: {
          codigoCuenta: input.codigoCuenta,
          idBodega: input.idBodega,
          idOrdenCompra: input.idOrdenCompra,
          sinDiferencias,
          notas: input.notas?.trim() || null,
          cerradaPor: idUsuario,
          lineas: {
            create: [
              ...input.lineas.map((linea) => ({
                idLineaOrdenCompra: linea.idLineaOrdenCompra,
                idProducto: null,
                cantidadRecibida: new Prisma.Decimal(linea.cantidadRecibida),
                temperaturaRegistrada:
                  linea.temperaturaRegistrada != null
                    ? new Prisma.Decimal(linea.temperaturaRegistrada)
                    : null,
                esAdicional: false,
              })),
              ...(input.lineasAdicionales ?? []).map(
                (linea: RecepcionLineaAdicionalInput) => ({
                  idLineaOrdenCompra: null,
                  idProducto: linea.idProducto,
                  cantidadRecibida: new Prisma.Decimal(linea.cantidadRecibida),
                  temperaturaRegistrada:
                    linea.temperaturaRegistrada != null
                      ? new Prisma.Decimal(linea.temperaturaRegistrada)
                      : null,
                  esAdicional: true,
                  tituloSnapshot: linea.tituloSnapshot?.trim() || null,
                }),
              ),
            ],
          },
        },
        include: recepcionInclude,
      });

      for (const linea of lineasActualizadas) {
        await tx.ordenCompraLinea.update({
          where: { idLineaOrdenCompra: linea.idLineaOrdenCompra },
          data: { cantidadRecibida: linea.cantidadRecibida },
        });
      }

      await tx.ordenCompra.update({
        where: { idOrdenCompra: input.idOrdenCompra },
        data: { estado: nuevoEstadoOrden },
      });

      if (ingresoInventario) {
        for (const entrada of ingresoInventario.entradas) {
          if (entrada.cantidad.lte(0)) {
            continue;
          }

          const codigoLote = `REC-${Date.now()}-${entrada.idProducto.slice(0, 8)}`;

          const lote = await tx.lote.create({
            data: {
              codigoCuenta: input.codigoCuenta,
              idBodega: input.idBodega,
              idProducto: entrada.idProducto,
              codigoLote,
              temperaturaObjetivo: entrada.temperatura ?? null,
            },
          });

          await tx.warehouseState.create({
            data: {
              codigoCuenta: input.codigoCuenta,
              idBodega: input.idBodega,
              idUbicacion: ingresoInventario.idUbicacionIngreso,
              idProducto: entrada.idProducto,
              idLote: lote.idLote,
              cantidad: entrada.cantidad,
              temperatura: entrada.temperatura ?? null,
            },
          });

          await tx.movimientoInventario.create({
            data: {
              codigoCuenta: input.codigoCuenta,
              idBodega: input.idBodega,
              idUbicacionDestino: ingresoInventario.idUbicacionIngreso,
              idProducto: entrada.idProducto,
              idLote: lote.idLote,
              cantidad: entrada.cantidad,
              tipoMovimiento: TipoMovimiento.recepcion,
              idUsuario,
              idReferencia: input.idOrdenCompra,
              tipoReferencia: TIPO_REFERENCIA_RECEPCION,
              metadata: {
                idRecepcion: recepcion.idRecepcion,
              },
            },
          });
        }

        await syncUbicacionEstadoSlot(tx, ingresoInventario.idUbicacionIngreso);
      }

      return recepcion;
    });
  }

  toResponse(recepcion: RecepcionWithLineas): RecepcionCompraResponse {
    return {
      idRecepcion: recepcion.idRecepcion,
      codigoCuenta: recepcion.codigoCuenta,
      idBodega: recepcion.idBodega,
      idOrdenCompra: recepcion.idOrdenCompra,
      sinDiferencias: recepcion.sinDiferencias,
      notas: recepcion.notas,
      cerradaAt: recepcion.cerradaAt,
      cerradaPor: recepcion.cerradaPor,
      createdAt: recepcion.createdAt,
      estadoOrdenCompra: recepcion.ordenCompra.estado,
      lineas: recepcion.lineas.map((linea) => ({
        idLineaRecepcion: linea.idLineaRecepcion,
        idLineaOrdenCompra: linea.idLineaOrdenCompra,
        idProducto: linea.idProducto,
        cantidadRecibida: linea.cantidadRecibida.toString(),
        temperaturaRegistrada: linea.temperaturaRegistrada?.toString() ?? null,
        esAdicional: linea.esAdicional,
        tituloSnapshot: linea.tituloSnapshot,
      })),
    };
  }
}
