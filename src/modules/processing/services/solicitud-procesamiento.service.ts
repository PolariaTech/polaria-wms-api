import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoProcesamiento } from '../../../generated/prisma/client';
import {
  applyTenantFilter,
  assertOperationalTenantScope,
} from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type {
  AsignarProcesadorDto,
  CambiarEstadoProcesamientoDto,
  CerrarSolicitudProcesamientoDto,
  CreateSolicitudProcesamientoDto,
  ListSolicitudesProcesamientoQueryDto,
} from '../dto/processing.dto';
import { SolicitudProcesamientoRepository } from '../infrastructure/solicitud-procesamiento.repository';
import type { SolicitudProcesamientoResponse } from '../interfaces/processing.interfaces';

@Injectable()
export class SolicitudProcesamientoService {
  constructor(private readonly repository: SolicitudProcesamientoRepository) {}

  async list(
    query: ListSolicitudesProcesamientoQueryDto,
    ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse[]> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: query.codigoCuenta,
      idBodega: query.idBodega,
    });

    const where = applyTenantFilter(
      {
        codigoCuenta: query.codigoCuenta,
        idBodega: query.idBodega,
        ...(query.estado ? { estado: query.estado as EstadoProcesamiento } : {}),
        ...(query.idProcesador ? { idProcesador: query.idProcesador } : {}),
      },
      ctx,
    );

    const rows = await this.repository.list(where);
    return rows.map((row) => this.repository.toResponse(row));
  }

  async findById(
    id: string,
    ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    const row = await this.repository.findById(id);

    if (!row) {
      throw new NotFoundException('Solicitud de procesamiento no encontrada');
    }

    assertOperationalTenantScope(ctx, {
      codigoCuenta: row.codigoCuenta,
      idBodega: row.idBodega,
    });

    return this.repository.toResponse(row);
  }

  async create(
    dto: CreateSolicitudProcesamientoDto,
    ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    if (dto.kilosPrimario <= 0) {
      throw new BadRequestException('kilosPrimario debe ser mayor a 0');
    }

    const row = await this.repository.create(dto, ctx.idUsuario);
    return this.repository.toResponse(row);
  }

  async asignarProcesador(
    id: string,
    dto: AsignarProcesadorDto,
    ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const row = await this.repository.findById(id);

    if (!row) {
      throw new NotFoundException('Solicitud de procesamiento no encontrada');
    }

    const updated = await this.repository.asignarProcesador(id, dto.idProcesador);
    return this.repository.toResponse(updated);
  }

  async cambiarEstado(
    id: string,
    dto: CambiarEstadoProcesamientoDto,
    ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const row = await this.repository.findById(id);

    if (!row) {
      throw new NotFoundException('Solicitud de procesamiento no encontrada');
    }

    const updated = await this.repository.cambiarEstado(
      id,
      dto.estado as EstadoProcesamiento,
    );
    return this.repository.toResponse(updated);
  }

  async cerrar(
    id: string,
    dto: CerrarSolicitudProcesamientoDto,
    ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const row = await this.repository.findById(id);

    if (!row) {
      throw new NotFoundException('Solicitud de procesamiento no encontrada');
    }

    if (
      row.estado !== EstadoProcesamiento.en_proceso &&
      row.estado !== EstadoProcesamiento.pendiente_cierre
    ) {
      throw new BadRequestException(
        'Solo se puede cerrar una solicitud en proceso o pendiente de cierre',
      );
    }

    const updated = await this.repository.cerrar(row, dto, ctx.idUsuario);
    return this.repository.toResponse(updated);
  }
}
