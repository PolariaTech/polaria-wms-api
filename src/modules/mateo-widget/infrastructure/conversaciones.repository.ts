import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import type {
  MateoMensajeRol,
  MateoMensajeTipo,
} from '../interfaces/conversaciones.interfaces';

@Injectable()
export class ConversacionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByUsuario(idUsuario: string) {
    return this.prisma.widgetConversacion.findMany({
      where: { idUsuario },
      orderBy: { updatedAt: 'desc' },
      select: {
        idConversacion: true,
        titulo: true,
        codigoCuenta: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  findByIdForUsuario(idConversacion: string, idUsuario: string) {
    return this.prisma.widgetConversacion.findFirst({
      where: { idConversacion, idUsuario },
      include: {
        mensajes: {
          orderBy: { createdAt: 'asc' },
          select: {
            idMensaje: true,
            rol: true,
            tipo: true,
            contenido: true,
            esError: true,
            createdAt: true,
          },
        },
      },
    });
  }

  create(data: {
    idUsuario: string;
    codigoCuenta: string | null;
    titulo?: string | null;
  }) {
    return this.prisma.widgetConversacion.create({
      data: {
        idUsuario: data.idUsuario,
        codigoCuenta: data.codigoCuenta,
        titulo: data.titulo?.trim() || null,
      },
      select: {
        idConversacion: true,
        titulo: true,
        codigoCuenta: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async appendMensaje(params: {
    idConversacion: string;
    idUsuario: string;
    rol: MateoMensajeRol;
    tipo: MateoMensajeTipo;
    contenido: string;
    esError: boolean;
    createdAt?: Date;
  }) {
    const owned = await this.prisma.widgetConversacion.findFirst({
      where: {
        idConversacion: params.idConversacion,
        idUsuario: params.idUsuario,
      },
      select: { idConversacion: true },
    });

    if (!owned) {
      return null;
    }

    const [mensaje] = await this.prisma.$transaction([
      this.prisma.widgetMensaje.create({
        data: {
          idConversacion: params.idConversacion,
          rol: params.rol,
          tipo: params.tipo,
          contenido: params.contenido,
          esError: params.esError,
          ...(params.createdAt ? { createdAt: params.createdAt } : {}),
        },
        select: {
          idMensaje: true,
          rol: true,
          tipo: true,
          contenido: true,
          esError: true,
          createdAt: true,
        },
      }),
      this.prisma.widgetConversacion.update({
        where: { idConversacion: params.idConversacion },
        data: { updatedAt: new Date() },
      }),
    ]);

    return mensaje;
  }

  async deleteForUsuario(idConversacion: string, idUsuario: string) {
    const owned = await this.prisma.widgetConversacion.findFirst({
      where: { idConversacion, idUsuario },
      select: { idConversacion: true },
    });

    if (!owned) {
      return false;
    }

    await this.prisma.widgetConversacion.delete({
      where: { idConversacion },
    });

    return true;
  }
}
