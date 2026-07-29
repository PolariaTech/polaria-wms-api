import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import type {
  MateoMensajeRol,
  MateoMensajeTipo,
} from '../interfaces/conversaciones.interfaces';

/** Alineado con el widget (`content.slice(0, 40)`). */
export const WIDGET_TITULO_MAX_LEN = 40;

/** Título genérico cuando el primer mensaje es solo imagen (sin caption). */
export const WIDGET_TITULO_IMAGEN = 'Imagen';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

/** Título legible a partir de un mensaje de usuario (texto o imagen). */
export function tituloFromUserMensaje(
  tipo: string,
  contenido: string,
): string | null {
  const trimmed = contenido.trim();
  if (!trimmed) return null;
  if (tipo === 'image') return WIDGET_TITULO_IMAGEN;
  return trimmed.slice(0, WIDGET_TITULO_MAX_LEN);
}

/**
 * Decide si el mensaje entrante debe (re)escribir el título de la conversación.
 * - Primer mensaje user → fija título.
 * - Caption de texto tras una imagen → reemplaza el placeholder "Imagen".
 */
export function shouldUpdateTitulo(
  tituloActual: string | null | undefined,
  rol: string,
  tipo: string,
  esError: boolean,
): boolean {
  if (rol !== 'user' || esError) return false;
  if (!tituloActual) return true;
  return tituloActual === WIDGET_TITULO_IMAGEN && tipo === 'text';
}

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
        // Fallback para conversaciones antiguas con titulo null.
        mensajes: {
          where: { rol: 'user', esError: false },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { contenido: true, tipo: true },
        },
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
      select: { idConversacion: true, titulo: true },
    });

    if (!owned) {
      return null;
    }

    const createdAt = params.createdAt ?? new Date();
    const mensajeSelect = {
      idMensaje: true,
      rol: true,
      tipo: true,
      contenido: true,
      esError: true,
      createdAt: true,
    } as const;

    const nextTitulo = shouldUpdateTitulo(
      owned.titulo,
      params.rol,
      params.tipo,
      params.esError,
    )
      ? tituloFromUserMensaje(params.tipo, params.contenido)
      : null;

    const conversacionUpdate = {
      updatedAt: new Date(),
      ...(nextTitulo ? { titulo: nextTitulo } : {}),
    };

    let mensaje: {
      idMensaje: string;
      rol: string;
      tipo: string;
      contenido: string;
      esError: boolean;
      createdAt: Date;
    };

    try {
      [mensaje] = await this.prisma.$transaction([
        this.prisma.widgetMensaje.create({
          data: {
            idConversacion: params.idConversacion,
            rol: params.rol,
            tipo: params.tipo,
            contenido: params.contenido,
            esError: params.esError,
            createdAt,
          },
          select: mensajeSelect,
        }),
        this.prisma.widgetConversacion.update({
          where: { idConversacion: params.idConversacion },
          data: conversacionUpdate,
        }),
      ]);
    } catch (error) {
      // Dedupe ante reintentos del cliente: si el INSERT choca con UNIQUE,
      // devolvemos el mensaje ya persistido en vez de fallar.
      if (isUniqueViolation(error)) {
        const existing = await this.prisma.widgetMensaje.findFirst({
          where: {
            idConversacion: params.idConversacion,
            rol: params.rol,
            tipo: params.tipo,
            contenido: params.contenido,
            esError: params.esError,
            createdAt,
          },
          select: mensajeSelect,
        });

        if (existing) {
          await this.prisma.widgetConversacion.update({
            where: { idConversacion: params.idConversacion },
            data: conversacionUpdate,
          });
          return existing;
        }
      }

      throw error;
    }

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
