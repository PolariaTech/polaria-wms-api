import { Injectable } from '@nestjs/common';
import {
  EstadoAlerta,
  EstadoGuiaEnvio,
  EstadoOrdenVenta,
  TipoMovimiento,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { METADATA_SUBTIPO_LLAMADA_JEFE } from '../constants/operations.constants';
import type { BodegaReportesFechaRange } from '../utils/bodega-reportes-fecha-range.util';

export interface BodegaReportesResumen {
  ingresos: number;
  salidas: number;
  movimientos: number;
  despachados: number;
  alertas: number;
  mermaKg: number;
  ordenesTrabajoPendientes: number;
  tareasPendientes: number;
  llamadasPendientes: number;
}

@Injectable()
export class BodegaReportesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getResumen(
    codigoCuenta: string,
    idBodega: string,
    rango: BodegaReportesFechaRange,
  ): Promise<BodegaReportesResumen> {
    const base = { codigoCuenta, idBodega };
    const { desdeAt, hastaAt, fechaDesde, fechaHasta } = rango;
    const createdInRange = { gte: desdeAt, lte: hastaAt };
    /** `periodo` en merma es Date (sin hora). */
    const periodoInRange = {
      gte: new Date(`${fechaDesde}T00:00:00.000Z`),
      lte: new Date(`${fechaHasta}T00:00:00.000Z`),
    };

    const [
      ingresos,
      salidas,
      movimientos,
      despachados,
      alertas,
      mermaAgg,
      ordenesTrabajoPendientes,
      tareasPendientes,
      llamadasPendientes,
    ] = await Promise.all([
      this.prisma.recepcionCompra.count({
        where: {
          ...base,
          cerradaAt: createdInRange,
        },
      }),
      this.prisma.ordenVenta.count({
        where: {
          codigoCuenta,
          idBodega,
          estado: {
            in: [EstadoOrdenVenta.despachada, EstadoOrdenVenta.cerrada],
          },
          updatedAt: createdInRange,
        },
      }),
      this.prisma.movimientoInventario.count({
        where: {
          ...base,
          tipoMovimiento: TipoMovimiento.transferencia,
          createdAt: createdInRange,
        },
      }),
      this.prisma.guiaEnvio.count({
        where: {
          codigoCuenta,
          estado: EstadoGuiaEnvio.entregada,
          viaje: { idBodega },
          updatedAt: createdInRange,
        },
      }),
      this.prisma.alertaOperativa.count({
        where: {
          ...base,
          createdAt: createdInRange,
          NOT: {
            metadata: {
              path: ['subtipo'],
              equals: METADATA_SUBTIPO_LLAMADA_JEFE,
            },
          },
        },
      }),
      this.prisma.registroMerma.aggregate({
        where: {
          ...base,
          periodo: periodoInRange,
        },
        _sum: { kilosMerma: true },
      }),
      // Cola abierta: snapshot actual, sin filtro de fechas
      this.prisma.ordenTrabajo.count({
        where: {
          ...base,
          estado: { in: ['planificada', 'en_proceso'] },
        },
      }),
      this.prisma.tareaCola.count({
        where: {
          ...base,
          estado: { in: ['pendiente', 'en_proceso'] },
        },
      }),
      this.prisma.alertaOperativa.count({
        where: {
          ...base,
          estado: EstadoAlerta.abierta,
          metadata: {
            path: ['subtipo'],
            equals: METADATA_SUBTIPO_LLAMADA_JEFE,
          },
        },
      }),
    ]);

    const mermaKg = Number(mermaAgg._sum.kilosMerma ?? 0);

    return {
      ingresos,
      salidas,
      movimientos,
      despachados,
      alertas,
      mermaKg: Math.round(mermaKg * 10) / 10,
      ordenesTrabajoPendientes,
      tareasPendientes,
      llamadasPendientes,
    };
  }
}
