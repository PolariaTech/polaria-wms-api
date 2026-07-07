import { Injectable } from '@nestjs/common';
import {
  EstadoProcesamiento,
  EstadoTarea,
  Prisma,
  TipoMovimiento,
  TipoTarea,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  CONTADOR_CLAVE_SOLICITUD_PROCESAMIENTO,
  TIPO_REFERENCIA_PROCESAMIENTO,
  formatCodigoSolicitudProcesamiento,
} from '../constants/processing.constants';
import type {
  CerrarSolicitudProcesamientoInput,
  CreateSolicitudProcesamientoInput,
  SolicitudProcesamientoResponse,
} from '../interfaces/processing.interfaces';

export type SolicitudRow = Prisma.SolicitudProcesamientoGetPayload<object>;

@Injectable()
export class SolicitudProcesamientoRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(where: Prisma.SolicitudProcesamientoWhereInput): Promise<SolicitudRow[]> {
    return this.prisma.solicitudProcesamiento.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<SolicitudRow | null> {
    return this.prisma.solicitudProcesamiento.findUnique({
      where: { idSolicitudProcesamiento: id },
    });
  }

  async create(
    input: CreateSolicitudProcesamientoInput,
    idSolicitante: string,
  ): Promise<SolicitudRow> {
    return this.prisma.$transaction(async (tx) => {
      const codigo = await this.nextCodigo(tx, input.codigoCuenta, input.idBodega);

      const estimado =
        input.reglaConversionCantidadPrimario &&
        input.reglaConversionUnidadesSecundario &&
        input.kilosPrimario > 0
          ? (input.kilosPrimario / input.reglaConversionCantidadPrimario) *
            input.reglaConversionUnidadesSecundario
          : null;

      const solicitud = await tx.solicitudProcesamiento.create({
        data: {
          codigoCuenta: input.codigoCuenta,
          idBodega: input.idBodega,
          codigo,
          idCliente: input.idCliente ?? null,
          idProductoPrimario: input.idProductoPrimario,
          idProductoSecundario: input.idProductoSecundario,
          idSolicitante,
          estado: EstadoProcesamiento.pendiente,
          kilosPrimario: new Prisma.Decimal(input.kilosPrimario),
          reglaConversionCantidadPrimario:
            input.reglaConversionCantidadPrimario != null
              ? new Prisma.Decimal(input.reglaConversionCantidadPrimario)
              : null,
          reglaConversionUnidadesSecundario:
            input.reglaConversionUnidadesSecundario != null
              ? new Prisma.Decimal(input.reglaConversionUnidadesSecundario)
              : null,
          perdidaProcesamientoPct:
            input.perdidaProcesamientoPct != null
              ? new Prisma.Decimal(input.perdidaProcesamientoPct)
              : null,
          estimadoUnidadesSecundario:
            estimado != null ? new Prisma.Decimal(estimado) : null,
          observaciones: input.observaciones?.trim() || null,
        },
      });

      await tx.tareaCola.create({
        data: {
          codigoCuenta: input.codigoCuenta,
          idBodega: input.idBodega,
          tipo: TipoTarea.procesamiento,
          estado: EstadoTarea.pendiente,
          titulo: `Procesamiento · ${codigo}`,
          descripcion: input.observaciones?.trim() || null,
        },
      });

      return solicitud;
    });
  }

  asignarProcesador(
    id: string,
    idProcesador: string,
  ): Promise<SolicitudRow> {
    return this.prisma.solicitudProcesamiento.update({
      where: { idSolicitudProcesamiento: id },
      data: {
        idProcesador,
        estado: EstadoProcesamiento.en_proceso,
      },
    });
  }

  cambiarEstado(
    id: string,
    estado: EstadoProcesamiento,
  ): Promise<SolicitudRow> {
    return this.prisma.solicitudProcesamiento.update({
      where: { idSolicitudProcesamiento: id },
      data: { estado },
    });
  }

  async cerrar(
    solicitud: SolicitudRow,
    input: CerrarSolicitudProcesamientoInput,
    idUsuario: string,
  ): Promise<SolicitudRow> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.solicitudProcesamiento.update({
        where: { idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento },
        data: {
          estado: EstadoProcesamiento.terminada,
          kilosSecundario: new Prisma.Decimal(input.kilosSecundario),
          kilosMerma: new Prisma.Decimal(input.kilosMerma),
          sobranteKg:
            input.sobranteKg != null
              ? new Prisma.Decimal(input.sobranteKg)
              : null,
          cierreDesdeProcesador: true,
          kgPrimarioDescontado: solicitud.kilosPrimario,
        },
      });

      await tx.registroMerma.create({
        data: {
          idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento,
          idBodega: solicitud.idBodega,
          codigoCuenta: solicitud.codigoCuenta,
          kilosMerma: new Prisma.Decimal(input.kilosMerma),
          periodo: new Date(),
        },
      });

      await tx.movimientoInventario.create({
        data: {
          codigoCuenta: solicitud.codigoCuenta,
          idBodega: solicitud.idBodega,
          idProducto: solicitud.idProductoPrimario,
          cantidad: solicitud.kilosPrimario,
          tipoMovimiento: TipoMovimiento.merma,
          idUsuario,
          idReferencia: solicitud.idSolicitudProcesamiento,
          tipoReferencia: TIPO_REFERENCIA_PROCESAMIENTO,
          metadata: { tipo: 'merma_procesamiento', kilosMerma: input.kilosMerma },
        },
      });

      await tx.tareaCola.updateMany({
        where: {
          codigoCuenta: solicitud.codigoCuenta,
          idBodega: solicitud.idBodega,
          tipo: TipoTarea.procesamiento,
          titulo: { contains: solicitud.codigo },
          estado: { in: [EstadoTarea.pendiente, EstadoTarea.en_proceso] },
        },
        data: { estado: EstadoTarea.completada, idAsignado: idUsuario },
      });

      return updated;
    });
  }

  private async nextCodigo(
    tx: Prisma.TransactionClient,
    codigoCuenta: string,
    idBodega: string,
  ): Promise<string> {
    const existing = await tx.contador.findFirst({
      where: {
        codigoCuenta,
        idBodega,
        clave: CONTADOR_CLAVE_SOLICITUD_PROCESAMIENTO,
      },
    });

    if (existing) {
      const updated = await tx.contador.update({
        where: { idContador: existing.idContador },
        data: { valor: { increment: 1 } },
      });
      return formatCodigoSolicitudProcesamiento(updated.valor);
    }

    const created = await tx.contador.create({
      data: {
        codigoCuenta,
        idBodega,
        clave: CONTADOR_CLAVE_SOLICITUD_PROCESAMIENTO,
        valor: 1n,
      },
    });
    return formatCodigoSolicitudProcesamiento(created.valor);
  }

  toResponse(row: SolicitudRow): SolicitudProcesamientoResponse {
    return {
      idSolicitudProcesamiento: row.idSolicitudProcesamiento,
      codigoCuenta: row.codigoCuenta,
      idBodega: row.idBodega,
      codigo: row.codigo,
      idCliente: row.idCliente,
      idProductoPrimario: row.idProductoPrimario,
      idProductoSecundario: row.idProductoSecundario,
      idSolicitante: row.idSolicitante,
      idProcesador: row.idProcesador,
      estado: row.estado,
      kilosPrimario: row.kilosPrimario.toString(),
      kilosSecundario: row.kilosSecundario?.toString() ?? null,
      kilosMerma: row.kilosMerma?.toString() ?? null,
      sobranteKg: row.sobranteKg?.toString() ?? null,
      reglaConversionCantidadPrimario:
        row.reglaConversionCantidadPrimario?.toString() ?? null,
      reglaConversionUnidadesSecundario:
        row.reglaConversionUnidadesSecundario?.toString() ?? null,
      perdidaProcesamientoPct: row.perdidaProcesamientoPct?.toString() ?? null,
      estimadoUnidadesSecundario: row.estimadoUnidadesSecundario?.toString() ?? null,
      kgPrimarioDescontado: row.kgPrimarioDescontado?.toString() ?? null,
      cierreDesdeProcesador: row.cierreDesdeProcesador,
      observaciones: row.observaciones,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
