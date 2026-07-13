import { Injectable } from '@nestjs/common';
import { EstadoTarea, Prisma, TipoTarea } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import type { TareaColaResponse } from '../interfaces/operations.interfaces';

const tareaInclude = {} satisfies Prisma.TareaColaInclude;

export type TareaColaRow = Prisma.TareaColaGetPayload<{
  include: typeof tareaInclude;
}>;

@Injectable()
export class TareaColaRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(where: Prisma.TareaColaWhereInput): Promise<TareaColaRow[]> {
    return this.prisma.tareaCola.findMany({
      where,
      orderBy: [{ estado: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findById(idTarea: string): Promise<TareaColaRow | null> {
    return this.prisma.tareaCola.findUnique({ where: { idTarea } });
  }

  asignar(
    idTarea: string,
    idAsignado: string | null,
  ): Promise<TareaColaRow> {
    return this.prisma.tareaCola.update({
      where: { idTarea },
      data: {
        idAsignado,
        estado: EstadoTarea.en_proceso,
      },
    });
  }

  completar(idTarea: string, idUsuario: string): Promise<TareaColaRow> {
    return this.prisma.tareaCola.update({
      where: { idTarea },
      data: {
        estado: EstadoTarea.completada,
        idAsignado: idUsuario,
      },
    });
  }

  cancelar(idTarea: string): Promise<TareaColaRow> {
    return this.prisma.tareaCola.update({
      where: { idTarea },
      data: { estado: EstadoTarea.cancelada },
    });
  }

  createProcesamiento(input: {
    codigoCuenta: string;
    idBodega: string;
    idOrdenTrabajo?: string;
    idSolicitudProcesamiento?: string;
    titulo: string;
    descripcion?: string;
    idAsignado?: string;
  }): Promise<TareaColaRow> {
    return this.prisma.tareaCola.create({
      data: {
        codigoCuenta: input.codigoCuenta,
        idBodega: input.idBodega,
        tipo: TipoTarea.procesamiento,
        estado: EstadoTarea.pendiente,
        idOrdenTrabajo: input.idOrdenTrabajo ?? null,
        idSolicitudProcesamiento: input.idSolicitudProcesamiento ?? null,
        titulo: input.titulo,
        descripcion: input.descripcion ?? null,
        idAsignado: input.idAsignado ?? null,
      },
    });
  }

  toResponse(row: TareaColaRow): TareaColaResponse {
    return {
      idTarea: row.idTarea,
      codigoCuenta: row.codigoCuenta,
      idBodega: row.idBodega,
      tipo: row.tipo,
      estado: row.estado,
      idAsignado: row.idAsignado,
      idOrdenTrabajo: row.idOrdenTrabajo,
      idSolicitudProcesamiento: row.idSolicitudProcesamiento,
      titulo: row.titulo,
      descripcion: row.descripcion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
