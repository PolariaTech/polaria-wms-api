import { Injectable } from '@nestjs/common';
import {
  EstadoSlot,
  Prisma,
  TipoMovimiento,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  metadataMovimientoProcesamiento,
  TIPO_REFERENCIA_PROCESAMIENTO,
} from '../constants/processing.constants';

export interface DescuentoPrimarioResult {
  kgDescontado: number;
  idWarehouseState: string | null;
  idUbicacion: string | null;
}

@Injectable()
export class ProcesamientoInventarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async sumDisponibleAlmacenamiento(params: {
    codigoCuenta: string;
    idBodega: string;
    idProducto: string;
  }): Promise<number> {
    const rows = await this.prisma.warehouseState.findMany({
      where: {
        codigoCuenta: params.codigoCuenta,
        idBodega: params.idBodega,
        idProducto: params.idProducto,
        cantidad: { gt: 0 },
        ubicacion: {
          estaActiva: true,
          tipoUbicacion: { esAlmacenamiento: true },
        },
      },
      select: { cantidad: true, cantidadReservada: true },
    });

    return rows.reduce((acc, row) => {
      const disponible = row.cantidad.sub(row.cantidadReservada);
      return acc + Math.max(0, Number(disponible.toString()));
    }, 0);
  }

  async resolverSlotOrigenFifo(
    tx: Prisma.TransactionClient,
    params: {
      codigoCuenta: string;
      idBodega: string;
      idProducto: string;
      kilosRequeridos: number;
    },
  ): Promise<{ idUbicacion: string; idWarehouseState: string } | null> {
    const candidatos = await tx.warehouseState.findMany({
      where: {
        codigoCuenta: params.codigoCuenta,
        idBodega: params.idBodega,
        idProducto: params.idProducto,
        cantidad: { gt: 0 },
        ubicacion: {
          estaActiva: true,
          tipoUbicacion: { esAlmacenamiento: true },
        },
      },
      orderBy: [{ ubicacion: { codigo: 'asc' } }, { updatedAt: 'asc' }],
    });

    const objetivo = new Prisma.Decimal(params.kilosRequeridos);

    for (const ws of candidatos) {
      const disponible = ws.cantidad.sub(ws.cantidadReservada);
      if (disponible.gte(objetivo)) {
        return {
          idUbicacion: ws.idUbicacion,
          idWarehouseState: ws.idWarehouseState,
        };
      }
    }

    return null;
  }

  async resolverSlotProcesamientoLibre(
    tx: Prisma.TransactionClient,
    params: { codigoCuenta: string; idBodega: string },
  ): Promise<string | null> {
    const slot = await tx.ubicacion.findFirst({
      where: {
        codigoCuenta: params.codigoCuenta,
        idBodega: params.idBodega,
        estaActiva: true,
        estadoSlot: EstadoSlot.libre,
        tipoUbicacion: { codigo: 'PROCESAMIENTO' },
      },
      orderBy: { codigo: 'asc' },
    });

    return slot?.idUbicacion ?? null;
  }

  async registrarMermaProcesamiento(
    tx: Prisma.TransactionClient,
    params: {
      codigoCuenta: string;
      idBodega: string;
      idProductoPrimario: string;
      kilosMerma: number;
      idSolicitudProcesamiento: string;
      idUsuario: string;
    },
  ): Promise<void> {
    if (params.kilosMerma <= 0) {
      return;
    }

    const candidatos = await tx.warehouseState.findMany({
      where: {
        codigoCuenta: params.codigoCuenta,
        idBodega: params.idBodega,
        idProducto: params.idProductoPrimario,
        cantidad: { gt: 0 },
        ubicacion: {
          estaActiva: true,
          tipoUbicacion: { codigo: 'PROCESAMIENTO' },
        },
      },
      orderBy: [{ ubicacion: { codigo: 'asc' } }, { updatedAt: 'asc' }],
    });

    if (candidatos.length === 0) {
      throw new Error('STOCK_PROCESAMIENTO_NO_ENCONTRADO');
    }

    let restante = new Prisma.Decimal(params.kilosMerma);

    for (const ws of candidatos) {
      if (restante.lte(0)) {
        break;
      }

      const disponible = ws.cantidad.sub(ws.cantidadReservada);
      if (disponible.lte(0)) {
        continue;
      }

      const aplicar = Prisma.Decimal.min(disponible, restante);
      const nuevaCantidad = ws.cantidad.sub(aplicar);

      await tx.warehouseState.update({
        where: { idWarehouseState: ws.idWarehouseState },
        data: {
          cantidad: nuevaCantidad,
          version: { increment: 1 },
        },
      });

      await tx.movimientoInventario.create({
        data: {
          codigoCuenta: params.codigoCuenta,
          idBodega: params.idBodega,
          idProducto: params.idProductoPrimario,
          idUbicacionOrigen: ws.idUbicacion,
          cantidad: aplicar,
          tipoMovimiento: TipoMovimiento.merma,
          idUsuario: params.idUsuario,
          idReferencia: params.idSolicitudProcesamiento,
          tipoReferencia: TIPO_REFERENCIA_PROCESAMIENTO,
          metadata: metadataMovimientoProcesamiento('merma_procesamiento'),
        },
      });

      if (nuevaCantidad.lte(0)) {
        await tx.ubicacion.update({
          where: { idUbicacion: ws.idUbicacion },
          data: { estadoSlot: EstadoSlot.libre },
        });
      }

      restante = restante.sub(aplicar);
    }

    if (restante.gt(0)) {
      throw new Error('STOCK_INSUFICIENTE_MERMA');
    }
  }

  async descontarPrimarioEnCurso(
    tx: Prisma.TransactionClient,
    params: {
      codigoCuenta: string;
      idBodega: string;
      idProductoPrimario: string;
      kilosADescontar: number;
      idSolicitudProcesamiento: string;
      idUsuario: string;
    },
  ): Promise<DescuentoPrimarioResult> {
    const candidatos = await tx.warehouseState.findMany({
      where: {
        codigoCuenta: params.codigoCuenta,
        idBodega: params.idBodega,
        idProducto: params.idProductoPrimario,
        cantidad: { gt: 0 },
        ubicacion: {
          estaActiva: true,
          tipoUbicacion: { esAlmacenamiento: true },
        },
      },
      orderBy: [{ ubicacion: { codigo: 'asc' } }, { updatedAt: 'asc' }],
    });

    if (candidatos.length === 0) {
      return { kgDescontado: 0, idWarehouseState: null, idUbicacion: null };
    }

    const objetivo = new Prisma.Decimal(params.kilosADescontar);
    let restante = objetivo;
    let totalDescontado = new Prisma.Decimal(0);
    let lastWsId: string | null = null;
    let lastUbicacionId: string | null = null;

    for (const ws of candidatos) {
      if (restante.lte(0)) break;

      const disponible = ws.cantidad.sub(ws.cantidadReservada);
      if (disponible.lte(0)) continue;

      const aplicar = Prisma.Decimal.min(disponible, restante);
      const nuevaCantidad = ws.cantidad.sub(aplicar);

      await tx.warehouseState.update({
        where: { idWarehouseState: ws.idWarehouseState },
        data: {
          cantidad: nuevaCantidad,
          version: { increment: 1 },
        },
      });

      await tx.movimientoInventario.create({
        data: {
          codigoCuenta: params.codigoCuenta,
          idBodega: params.idBodega,
          idProducto: params.idProductoPrimario,
          idUbicacionOrigen: ws.idUbicacion,
          cantidad: aplicar,
          tipoMovimiento: TipoMovimiento.consumo_ot,
          idUsuario: params.idUsuario,
          idReferencia: params.idSolicitudProcesamiento,
          tipoReferencia: TIPO_REFERENCIA_PROCESAMIENTO,
          metadata: metadataMovimientoProcesamiento('iniciar_en_curso'),
        },
      });

      if (nuevaCantidad.lte(0)) {
        await tx.ubicacion.update({
          where: { idUbicacion: ws.idUbicacion },
          data: { estadoSlot: EstadoSlot.libre },
        });
      } else {
        await tx.ubicacion.update({
          where: { idUbicacion: ws.idUbicacion },
          data: { estadoSlot: EstadoSlot.ocupado },
        });
      }

      restante = restante.sub(aplicar);
      totalDescontado = totalDescontado.add(aplicar);
      lastWsId = ws.idWarehouseState;
      lastUbicacionId = ws.idUbicacion;
    }

    return {
      kgDescontado: Number(totalDescontado.toString()),
      idWarehouseState: lastWsId,
      idUbicacion: lastUbicacionId,
    };
  }

  async ubicarSecundarioProcesado(
    tx: Prisma.TransactionClient,
    params: {
      codigoCuenta: string;
      idBodega: string;
      idProductoSecundario: string;
      idUbicacionDestino: string;
      unidades: number;
      idSolicitudProcesamiento: string;
      idUsuario: string;
    },
  ): Promise<void> {
    const cantidad = new Prisma.Decimal(params.unidades);

    const existente = await tx.warehouseState.findFirst({
      where: {
        idUbicacion: params.idUbicacionDestino,
        idProducto: params.idProductoSecundario,
        idLote: null,
      },
    });

    if (existente) {
      await tx.warehouseState.update({
        where: { idWarehouseState: existente.idWarehouseState },
        data: {
          cantidad: existente.cantidad.add(cantidad),
          version: { increment: 1 },
        },
      });
    } else {
      await tx.warehouseState.create({
        data: {
          codigoCuenta: params.codigoCuenta,
          idBodega: params.idBodega,
          idUbicacion: params.idUbicacionDestino,
          idProducto: params.idProductoSecundario,
          cantidad,
        },
      });
    }

    await tx.ubicacion.update({
      where: { idUbicacion: params.idUbicacionDestino },
      data: { estadoSlot: EstadoSlot.ocupado },
    });

    await tx.movimientoInventario.create({
      data: {
        codigoCuenta: params.codigoCuenta,
        idBodega: params.idBodega,
        idProducto: params.idProductoSecundario,
        idUbicacionDestino: params.idUbicacionDestino,
        cantidad,
        tipoMovimiento: TipoMovimiento.produccion_ot,
        idUsuario: params.idUsuario,
        idReferencia: params.idSolicitudProcesamiento,
        tipoReferencia: TIPO_REFERENCIA_PROCESAMIENTO,
        metadata: metadataMovimientoProcesamiento('ubicar_procesado'),
      },
    });
  }

  async devolverSobrantePrimario(
    tx: Prisma.TransactionClient,
    params: {
      codigoCuenta: string;
      idBodega: string;
      idProductoPrimario: string;
      idUbicacionDestino: string;
      sobranteKg: number;
      idSolicitudProcesamiento: string;
      idUsuario: string;
    },
  ): Promise<void> {
    if (params.sobranteKg <= 0) return;

    const cantidad = new Prisma.Decimal(params.sobranteKg);

    const existente = await tx.warehouseState.findFirst({
      where: {
        idUbicacion: params.idUbicacionDestino,
        idProducto: params.idProductoPrimario,
        idLote: null,
      },
    });

    if (existente) {
      await tx.warehouseState.update({
        where: { idWarehouseState: existente.idWarehouseState },
        data: {
          cantidad: existente.cantidad.add(cantidad),
          version: { increment: 1 },
        },
      });
    } else {
      await tx.warehouseState.create({
        data: {
          codigoCuenta: params.codigoCuenta,
          idBodega: params.idBodega,
          idUbicacion: params.idUbicacionDestino,
          idProducto: params.idProductoPrimario,
          cantidad,
        },
      });
    }

    await tx.ubicacion.update({
      where: { idUbicacion: params.idUbicacionDestino },
      data: { estadoSlot: EstadoSlot.ocupado },
    });

    await tx.movimientoInventario.create({
      data: {
        codigoCuenta: params.codigoCuenta,
        idBodega: params.idBodega,
        idProducto: params.idProductoPrimario,
        idUbicacionDestino: params.idUbicacionDestino,
        cantidad,
        tipoMovimiento: TipoMovimiento.transferencia,
        idUsuario: params.idUsuario,
        idReferencia: params.idSolicitudProcesamiento,
        tipoReferencia: TIPO_REFERENCIA_PROCESAMIENTO,
        metadata: metadataMovimientoProcesamiento('devolver_sobrante'),
      },
    });
  }

  async tieneSecundarioUbicado(
    tx: Prisma.TransactionClient,
    params: {
      idBodega: string;
      idProductoSecundario: string;
      unidadesMinimas: number;
    },
  ): Promise<boolean> {
    const rows = await tx.warehouseState.findMany({
      where: {
        idBodega: params.idBodega,
        idProducto: params.idProductoSecundario,
        cantidad: { gte: params.unidadesMinimas },
        ubicacion: {
          tipoUbicacion: { esAlmacenamiento: true },
        },
      },
      take: 1,
    });
    return rows.length > 0;
  }
}
