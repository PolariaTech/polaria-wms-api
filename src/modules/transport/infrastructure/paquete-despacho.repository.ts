import { Injectable } from '@nestjs/common';
import {
  EstadoGuiaEnvio,
  EstadoOrdenVenta,
  EstadoViajeTransporte,
  Prisma,
  TipoMovimiento,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { syncUbicacionEstadoSlot } from '../../inventory/utils/sync-ubicacion-estado-slot.util';
import {
  OrdenVentaEstadoError,
  registrarDespachoOv,
} from '../../sales/utils/orden-venta-estado.util';
import {
  CONTADOR_CLAVE_GUIA_ENVIO,
  CONTADOR_CLAVE_VIAJE_TRANSPORTE,
  TIPO_REFERENCIA_DESPACHO_PAQUETE,
  formatCodigoGuia,
  formatCodigoViaje,
} from '../constants/transport.constants';
import type {
  CrearPaqueteDespachoInput,
  GuiaPaqueteDespachoResponse,
  PaqueteDespachoResponse,
} from '../interfaces/transport.interfaces';

const ESTADOS_OV_PAQUETE: EstadoOrdenVenta[] = [
  EstadoOrdenVenta.confirmada,
  EstadoOrdenVenta.en_preparacion,
  EstadoOrdenVenta.parcialmente_despachada,
  EstadoOrdenVenta.despachada,
];

@Injectable()
export class PaqueteDespachoRepository {
  constructor(private readonly prisma: PrismaService) {}

  crearPaquete(
    input: CrearPaqueteDespachoInput,
  ): Promise<PaqueteDespachoResponse> {
    const codigoCuenta = input.codigoCuenta.trim();
    const idsOrden = [
      ...new Set(input.idOrdenesVenta.map((id) => id.trim()).filter(Boolean)),
    ];

    return this.prisma.$transaction(async (tx) => {
      const camion = await tx.camion.findFirst({
        where: {
          idCamion: input.idCamion,
          codigoCuenta,
          estaActivo: true,
        },
      });

      if (!camion) {
        throw new Error('CAMION_NO_ENCONTRADO');
      }

      if (!camion.disponible) {
        throw new Error('CAMION_NO_DISPONIBLE');
      }

      const ordenes = await tx.ordenVenta.findMany({
        where: {
          idOrdenVenta: { in: idsOrden },
          codigoCuenta,
          idBodega: input.idBodega,
        },
        include: {
          lineas: true,
          comprador: { select: { nombre: true } },
          bodegaDestino: { select: { nombre: true } },
          guiasEnvio: { select: { idGuia: true }, take: 1 },
        },
      });

      if (ordenes.length !== idsOrden.length) {
        throw new Error('OV_NO_ENCONTRADA');
      }

      for (const orden of ordenes) {
        if (!ESTADOS_OV_PAQUETE.includes(orden.estado)) {
          throw new Error(`OV_ESTADO_INVALIDO:${orden.codigo}`);
        }
        if (orden.lineas.length === 0) {
          throw new Error(`OV_SIN_LINEAS:${orden.codigo}`);
        }
        if (orden.guiasEnvio.length > 0) {
          throw new Error(`OV_YA_EN_TRANSPORTE:${orden.codigo}`);
        }
      }

      const salidaIds = await this.listSalidaUbicacionIds(tx, input.idBodega);
      if (salidaIds.length === 0) {
        throw new Error('SIN_ZONA_SALIDA');
      }

      const stockSalida = await tx.warehouseState.findMany({
        where: {
          idBodega: input.idBodega,
          codigoCuenta,
          idUbicacion: { in: salidaIds },
          cantidad: { gt: 0 },
        },
      });

      if (stockSalida.length === 0) {
        throw new Error('SIN_CAJAS_EN_SALIDA');
      }

      const codigoViaje = await this.nextCodigo(
        tx,
        codigoCuenta,
        input.idBodega,
        CONTADOR_CLAVE_VIAJE_TRANSPORTE,
        formatCodigoViaje,
      );

      const viaje = await tx.viajeTransporte.create({
        data: {
          codigoCuenta,
          idBodega: input.idBodega,
          idCamion: camion.idCamion,
          codigo: codigoViaje,
          estado: EstadoViajeTransporte.programado,
          fechaProgramada: new Date(),
          observaciones: `Paquete despacho: ${ordenes.map((o) => o.codigo).join(', ')}`,
        },
      });

      const guias: GuiaPaqueteDespachoResponse[] = [];
      const ubicacionesAfectadas = new Set<string>();

      for (const orden of ordenes) {
        const pendientes = orden.lineas
          .map((linea) => ({
            idProducto: linea.idProducto,
            cantidad: linea.cantidadPedida.sub(linea.cantidadDespachada),
          }))
          .filter((linea) => linea.cantidad.gt(0));

        if (pendientes.length > 0) {
          try {
            await registrarDespachoOv(tx, orden.idOrdenVenta, pendientes);
          } catch (error) {
            if (error instanceof OrdenVentaEstadoError) {
              throw new Error(error.message);
            }
            throw error;
          }
        } else if (orden.estado !== EstadoOrdenVenta.despachada) {
          await tx.ordenVenta.update({
            where: { idOrdenVenta: orden.idOrdenVenta },
            data: { estado: EstadoOrdenVenta.despachada },
          });
        }

        for (const linea of orden.lineas) {
          const afectados = await this.consumirStockSalida(
            tx,
            {
              codigoCuenta,
              idBodega: input.idBodega,
              idProducto: linea.idProducto,
              cantidad: linea.cantidadPedida,
              idUsuario: input.idUsuario,
              idOrdenVenta: orden.idOrdenVenta,
              idViaje: viaje.idViaje,
              salidaIds,
            },
            stockSalida,
          );
          for (const id of afectados) {
            ubicacionesAfectadas.add(id);
          }
        }

        const codigoGuia = await this.nextCodigo(
          tx,
          codigoCuenta,
          input.idBodega,
          CONTADOR_CLAVE_GUIA_ENVIO,
          formatCodigoGuia,
        );

        const destino =
          orden.bodegaDestino?.nombre?.trim() ||
          orden.comprador?.nombre?.trim() ||
          orden.codigo;

        const guia = await tx.guiaEnvio.create({
          data: {
            codigoCuenta,
            idViaje: viaje.idViaje,
            idOrdenVenta: orden.idOrdenVenta,
            codigo: codigoGuia,
            destino,
            estado: EstadoGuiaEnvio.asignada,
          },
        });

        guias.push({
          idGuia: guia.idGuia,
          codigo: guia.codigo,
          idOrdenVenta: orden.idOrdenVenta,
          codigoVenta: orden.codigo,
        });
      }

      for (const idUbicacion of ubicacionesAfectadas) {
        await syncUbicacionEstadoSlot(tx, idUbicacion);
      }

      await tx.camion.update({
        where: { idCamion: camion.idCamion },
        data: { disponible: false },
      });

      return {
        idViaje: viaje.idViaje,
        codigoViaje: viaje.codigo,
        idCamion: camion.idCamion,
        placaCamion: camion.placa,
        guias,
      };
    });
  }

  private async listSalidaUbicacionIds(
    tx: Prisma.TransactionClient,
    idBodega: string,
  ): Promise<string[]> {
    const rows = await tx.ubicacion.findMany({
      where: {
        idBodega,
        tipoUbicacion: { esPicking: true },
      },
      select: { idUbicacion: true },
    });
    return rows.map((row) => row.idUbicacion);
  }

  /**
   * Consume stock de zona salida (picking) para despachar al camión.
   * Soft: si no hay stock del producto no falla (la caja pudo verse en mapa
   * de otro producto); sí falla si no había ninguna caja al armar.
   */
  private async consumirStockSalida(
    tx: Prisma.TransactionClient,
    params: {
      codigoCuenta: string;
      idBodega: string;
      idProducto: string;
      cantidad: Prisma.Decimal;
      idUsuario: string;
      idOrdenVenta: string;
      idViaje: string;
      salidaIds: string[];
    },
    stockCache: Array<{
      idWarehouseState: string;
      idUbicacion: string;
      idProducto: string;
      idLote: string | null;
      cantidad: Prisma.Decimal;
      cantidadReservada: Prisma.Decimal;
    }>,
  ): Promise<string[]> {
    let restante = params.cantidad;
    const afectados: string[] = [];

    const candidatos = stockCache
      .filter(
        (row) =>
          row.idProducto === params.idProducto && row.cantidad.gt(0),
      )
      .sort((a, b) => Number(b.cantidad.sub(a.cantidad)));

    for (const row of candidatos) {
      if (restante.lte(0)) break;

      const tomar = Prisma.Decimal.min(row.cantidad, restante);
      const nuevaCantidad = row.cantidad.sub(tomar);
      const nuevaReservada = row.cantidadReservada.gt(tomar)
        ? row.cantidadReservada.sub(tomar)
        : new Prisma.Decimal(0);

      if (nuevaCantidad.lte(0)) {
        await tx.warehouseState.delete({
          where: { idWarehouseState: row.idWarehouseState },
        });
        row.cantidad = new Prisma.Decimal(0);
      } else {
        await tx.warehouseState.update({
          where: { idWarehouseState: row.idWarehouseState },
          data: {
            cantidad: nuevaCantidad,
            cantidadReservada: nuevaReservada,
            version: { increment: 1 },
          },
        });
        row.cantidad = nuevaCantidad;
        row.cantidadReservada = nuevaReservada;
      }

      await tx.movimientoInventario.create({
        data: {
          codigoCuenta: params.codigoCuenta,
          idBodega: params.idBodega,
          idUbicacionOrigen: row.idUbicacion,
          idUbicacionDestino: null,
          idProducto: row.idProducto,
          idLote: row.idLote,
          cantidad: tomar,
          tipoMovimiento: TipoMovimiento.despacho,
          idUsuario: params.idUsuario,
          idReferencia: params.idOrdenVenta,
          tipoReferencia: TIPO_REFERENCIA_DESPACHO_PAQUETE,
          metadata: {
            idViaje: params.idViaje,
            fase: 'paquete_despacho',
          },
        },
      });

      afectados.push(row.idUbicacion);
      restante = restante.sub(tomar);
    }

    return afectados;
  }

  private async nextCodigo(
    tx: Prisma.TransactionClient,
    codigoCuenta: string,
    idBodega: string,
    clave: string,
    format: (valor: bigint) => string,
  ): Promise<string> {
    const existing = await tx.contador.findFirst({
      where: { codigoCuenta, idBodega, clave },
    });

    if (existing) {
      const updated = await tx.contador.update({
        where: { idContador: existing.idContador },
        data: { valor: { increment: 1 } },
      });
      return format(updated.valor);
    }

    const created = await tx.contador.create({
      data: {
        codigoCuenta,
        idBodega,
        clave,
        valor: 1n,
      },
    });
    return format(created.valor);
  }
}
