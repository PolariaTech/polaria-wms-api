import { Injectable, NotFoundException } from '@nestjs/common';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import {
  AppendMensajeDto,
  CreateConversacionDto,
} from '../dto/conversaciones.dto';
import type {
  MateoConversacionDetalle,
  MateoConversacionListItem,
  MateoMensajeDto,
  MateoMensajeRol,
  MateoMensajeTipo,
} from '../interfaces/conversaciones.interfaces';
import { ConversacionesRepository } from '../infrastructure/conversaciones.repository';

@Injectable()
export class ConversacionesService {
  constructor(
    private readonly conversacionesRepository: ConversacionesRepository,
  ) {}

  async list(ctx: TenantContext): Promise<MateoConversacionListItem[]> {
    const rows = await this.conversacionesRepository.listByUsuario(
      ctx.idUsuario,
    );
    return rows.map((row) => this.toListItem(row));
  }

  async getDetalle(
    idConversacion: string,
    ctx: TenantContext,
  ): Promise<MateoConversacionDetalle> {
    const row = await this.conversacionesRepository.findByIdForUsuario(
      idConversacion,
      ctx.idUsuario,
    );

    if (!row) {
      throw new NotFoundException('Conversación no encontrada');
    }

    return {
      ...this.toListItem(row),
      mensajes: row.mensajes.map((m) => this.toMensaje(m)),
    };
  }

  async create(
    dto: CreateConversacionDto,
    ctx: TenantContext,
  ): Promise<MateoConversacionDetalle> {
    const created = await this.conversacionesRepository.create({
      idUsuario: ctx.idUsuario,
      codigoCuenta: ctx.codigoCuenta,
      titulo: dto.titulo,
    });

    return {
      ...this.toListItem(created),
      mensajes: [],
    };
  }

  async appendMensaje(
    idConversacion: string,
    dto: AppendMensajeDto,
    ctx: TenantContext,
  ): Promise<MateoMensajeDto> {
    const mensaje = await this.conversacionesRepository.appendMensaje({
      idConversacion,
      idUsuario: ctx.idUsuario,
      rol: dto.rol,
      tipo: dto.tipo ?? 'text',
      contenido: dto.contenido.trim(),
      esError: dto.esError ?? false,
      createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
    });

    if (!mensaje) {
      throw new NotFoundException('Conversación no encontrada');
    }

    return this.toMensaje(mensaje);
  }

  async remove(idConversacion: string, ctx: TenantContext): Promise<void> {
    const deleted = await this.conversacionesRepository.deleteForUsuario(
      idConversacion,
      ctx.idUsuario,
    );

    if (!deleted) {
      throw new NotFoundException('Conversación no encontrada');
    }
  }

  private toListItem(row: {
    idConversacion: string;
    titulo: string | null;
    codigoCuenta: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): MateoConversacionListItem {
    return {
      idConversacion: row.idConversacion,
      titulo: row.titulo,
      codigoCuenta: row.codigoCuenta,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMensaje(row: {
    idMensaje: string;
    rol: string;
    tipo: string;
    contenido: string;
    esError: boolean;
    createdAt: Date;
  }): MateoMensajeDto {
    return {
      idMensaje: row.idMensaje,
      rol: row.rol as MateoMensajeRol,
      tipo: row.tipo as MateoMensajeTipo,
      contenido: row.contenido,
      esError: row.esError,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
