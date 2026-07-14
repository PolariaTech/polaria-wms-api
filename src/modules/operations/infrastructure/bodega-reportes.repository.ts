import { Injectable } from '@nestjs/common';
import {
  EstadoAlerta,
  EstadoGuiaEnvio,
  EstadoOrdenVenta,
  TipoMovimiento,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { METADATA_SUBTIPO_LLAMADA_JEFE } from '../constants/operations.constants';

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
  ): Promise<BodegaReportesResumen> {
    const base = { codigoCuenta, idBodega };

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
      this.prisma.recepcionCompra.count({ where: base }),
      this.prisma.ordenVenta.count({
        where: {
          codigoCuenta,
          idBodega,
          estado: {
            in: [EstadoOrdenVenta.despachada, EstadoOrdenVenta.cerrada],
          },
        },
      }),
      this.prisma.movimientoInventario.count({
        where: {
          ...base,
          tipoMovimiento: TipoMovimiento.transferencia,
        },
      }),
      this.prisma.guiaEnvio.count({
        where: {
          codigoCuenta,
          estado: EstadoGuiaEnvio.entregada,
          viaje: { idBodega },
        },
      }),
      this.prisma.alertaOperativa.count({
        where: {
          ...base,
          NOT: {
            metadata: {
              path: ['subtipo'],
              equals: METADATA_SUBTIPO_LLAMADA_JEFE,
            },
          },
        },
      }),
      this.prisma.registroMerma.aggregate({
        where: { ...base },
        _sum: { kilosMerma: true },
      }),
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
