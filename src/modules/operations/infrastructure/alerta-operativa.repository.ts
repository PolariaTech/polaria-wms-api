import { Injectable } from '@nestjs/common';
import {
  EstadoAlerta,
  Prisma,
  TipoAlerta,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { METADATA_SUBTIPO_LLAMADA_JEFE } from '../constants/operations.constants';
import type {
  AlertaOperativaResponse,
  LlamadaOperativaResponse,
} from '../interfaces/operations.interfaces';

export type AlertaRow = Prisma.AlertaOperativaGetPayload<object>;

@Injectable()
export class AlertaOperativaRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(where: Prisma.AlertaOperativaWhereInput): Promise<AlertaRow[]> {
    return this.prisma.alertaOperativa.findMany({
      where: {
        ...where,
        NOT: {
          metadata: {
            path: ['subtipo'],
            equals: METADATA_SUBTIPO_LLAMADA_JEFE,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(idAlerta: string): Promise<AlertaRow | null> {
    return this.prisma.alertaOperativa.findUnique({ where: { idAlerta } });
  }

  create(input: {
    codigoCuenta: string;
    idBodega: string;
    tipo: TipoAlerta;
    titulo: string;
    descripcion?: string;
    idUbicacion?: string;
    idOrdenTrabajo?: string;
    idResponsable?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<AlertaRow> {
    return this.prisma.alertaOperativa.create({
      data: {
        codigoCuenta: input.codigoCuenta,
        idBodega: input.idBodega,
        tipo: input.tipo,
        titulo: input.titulo,
        descripcion: input.descripcion ?? null,
        idUbicacion: input.idUbicacion ?? null,
        idOrdenTrabajo: input.idOrdenTrabajo ?? null,
        idResponsable: input.idResponsable ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  }

  asignar(idAlerta: string, idResponsable: string): Promise<AlertaRow> {
    return this.prisma.alertaOperativa.update({
      where: { idAlerta },
      data: { idResponsable },
    });
  }

  cerrar(
    idAlerta: string,
    motivoCierre?: string,
  ): Promise<AlertaRow> {
    return this.prisma.alertaOperativa.update({
      where: { idAlerta },
      data: {
        estado: EstadoAlerta.cerrada,
        motivoCierre: motivoCierre?.trim() || null,
        cerradaAt: new Date(),
      },
    });
  }

  listLlamadas(where: Prisma.AlertaOperativaWhereInput): Promise<AlertaRow[]> {
    return this.prisma.alertaOperativa.findMany({
      where: {
        ...where,
        metadata: {
          path: ['subtipo'],
          equals: METADATA_SUBTIPO_LLAMADA_JEFE,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  crearLlamada(input: {
    codigoCuenta: string;
    idBodega: string;
    idSolicitante: string;
    fromRol: string;
    message: string;
  }): Promise<AlertaRow> {
    return this.prisma.alertaOperativa.create({
      data: {
        codigoCuenta: input.codigoCuenta,
        idBodega: input.idBodega,
        tipo: TipoAlerta.otro,
        titulo: input.message,
        descripcion: `Llamada desde ${input.fromRol}`,
        metadata: {
          subtipo: METADATA_SUBTIPO_LLAMADA_JEFE,
          fromRol: input.fromRol,
          idSolicitante: input.idSolicitante,
          atendida: false,
        },
      },
    });
  }

  atenderLlamada(idAlerta: string, idAtendidoPor: string): Promise<AlertaRow> {
    return this.prisma.alertaOperativa.findUnique({ where: { idAlerta } }).then(
      async (row) => {
        if (!row) {
          throw new Error('LLAMADA_NOT_FOUND');
        }
        const meta = (row.metadata as Record<string, unknown> | null) ?? {};
        return this.prisma.alertaOperativa.update({
          where: { idAlerta },
          data: {
            estado: EstadoAlerta.cerrada,
            cerradaAt: new Date(),
            idResponsable: idAtendidoPor,
            metadata: {
              ...meta,
              atendida: true,
              idAtendidoPor,
              atendidaAt: new Date().toISOString(),
            },
          },
        });
      },
    );
  }

  toResponse(row: AlertaRow): AlertaOperativaResponse {
    return {
      idAlerta: row.idAlerta,
      codigoCuenta: row.codigoCuenta,
      idBodega: row.idBodega,
      tipo: row.tipo,
      estado: row.estado,
      idUbicacion: row.idUbicacion,
      idOrdenTrabajo: row.idOrdenTrabajo,
      idResponsable: row.idResponsable,
      titulo: row.titulo,
      descripcion: row.descripcion,
      motivoCierre: row.motivoCierre,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt,
      cerradaAt: row.cerradaAt,
    };
  }

  toLlamadaResponse(row: AlertaRow): LlamadaOperativaResponse {
    const meta = (row.metadata as Record<string, unknown> | null) ?? {};
    return {
      idLlamada: row.idAlerta,
      codigoCuenta: row.codigoCuenta,
      idBodega: row.idBodega,
      fromRol: String(meta.fromRol ?? 'operario'),
      message: row.titulo,
      idSolicitante: String(meta.idSolicitante ?? ''),
      atendida: Boolean(meta.atendida) || row.estado === EstadoAlerta.cerrada,
      idAtendidoPor: (meta.idAtendidoPor as string | undefined) ?? row.idResponsable,
      createdAt: row.createdAt,
      atendidaAt: row.cerradaAt,
    };
  }
}
