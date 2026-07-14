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
import { desperdicioKgSugeridoDesdeMerma } from '../utils/desperdicio-kg-sugerido.util';
import {
  assertTransicionProcesamiento,
  mensajeTransicionProcesamiento,
} from '../utils/procesamiento-estado.util';
import type {
  AsignarOperarioDto,
  AsignarProcesadorDto,
  CambiarEstadoProcesamientoDto,
  CerrarSolicitudProcesamientoDto,
  CreateOrdenesPostCierreDto,
  CreateSolicitudProcesamientoDto,
  IniciarProcesamientoDto,
  ListSolicitudesProcesamientoQueryDto,
  TenantBodegaProcesamientoQueryDto,
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
        ...(query.estado
          ? { estado: query.estado as EstadoProcesamiento }
          : {}),
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

    try {
      const row = await this.repository.create(dto, ctx.idUsuario);
      return this.repository.toResponse(row);
    } catch (error) {
      if (error instanceof Error && error.message === 'PRODUCTO_NOT_FOUND') {
        throw new BadRequestException('Producto no encontrado en el catálogo');
      }
      if (error instanceof Error && error.message === 'STOCK_INSUFICIENTE') {
        throw new BadRequestException(
          'No hay stock suficiente del primario en almacenamiento para crear la solicitud',
        );
      }
      throw error;
    }
  }

  async asignarOperario(
    id: string,
    dto: AsignarOperarioDto,
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

    if (row.estado !== EstadoProcesamiento.pendiente) {
      throw new BadRequestException(
        'Solo se puede asignar operario en estado pendiente (Iniciado)',
      );
    }

    if (row.idOperario) {
      throw new BadRequestException(
        'La solicitud ya tiene un operario asignado',
      );
    }

    try {
      const updated = await this.repository.asignarOperario(
        row,
        dto.idOperario,
        ctx.idUsuario,
      );
      return this.repository.toResponse(updated);
    } catch (error) {
      if (error instanceof Error && error.message === 'TAREA_YA_EXISTE') {
        throw new BadRequestException(
          'Ya existe una tarea de procesamiento vinculada a esta solicitud',
        );
      }
      if (error instanceof Error && error.message === 'STOCK_INSUFICIENTE') {
        throw new BadRequestException(
          'No hay stock suficiente del primario en almacenamiento para asignar',
        );
      }
      if (
        error instanceof Error &&
        error.message === 'SLOT_PROCESAMIENTO_NO_DISPONIBLE'
      ) {
        throw new BadRequestException(
          'No hay slots libres en la zona de procesamiento',
        );
      }
      throw error;
    }
  }

  async iniciar(
    id: string,
    dto: IniciarProcesamientoDto,
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

    const tarea = await this.repository.findTareaVinculada(
      id,
      dto.codigoCuenta,
      dto.idBodega,
    );

    if (!tarea?.idOrdenTrabajo) {
      throw new BadRequestException(
        'No hay tarea de movimiento vinculada; el jefe debe asignar operario primero',
      );
    }

    const transicionError = assertTransicionProcesamiento({
      estadoActual: row.estado,
      estadoSiguiente: EstadoProcesamiento.en_proceso,
      idOperarioAsignado: row.idOperario ?? tarea.idAsignado ?? null,
      idUsuario: ctx.idUsuario,
    });

    if (transicionError) {
      throw new BadRequestException(
        mensajeTransicionProcesamiento(transicionError),
      );
    }

    try {
      const updated = await this.repository.iniciarEnCurso(
        row,
        tarea.idOrdenTrabajo,
        dto.idProcesador ?? null,
        ctx.idUsuario,
      );
      return this.repository.toResponse(updated);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'STOCK_INSUFICIENTE' ||
          error.message === 'OT_NOT_FOUND')
      ) {
        throw new BadRequestException(
          'No hay stock suficiente del primario en almacenamiento para iniciar el procesamiento',
        );
      }
      throw error;
    }
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

    const updated = await this.repository.asignarProcesador(
      id,
      dto.idProcesador,
    );
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

    const tarea = await this.repository.findTareaVinculada(
      id,
      dto.codigoCuenta,
      dto.idBodega,
    );

    const transicionError = assertTransicionProcesamiento({
      estadoActual: row.estado,
      estadoSiguiente: dto.estado,
      idOperarioAsignado: row.idOperario ?? tarea?.idAsignado ?? null,
      idUsuario: ctx.idUsuario,
      desperdicioKg: dto.desperdicioKg,
    });

    if (transicionError) {
      throw new BadRequestException(
        mensajeTransicionProcesamiento(transicionError),
      );
    }

    const updated = await this.repository.cambiarEstado(id, dto.estado);
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

    if (row.estado !== EstadoProcesamiento.en_proceso) {
      throw new BadRequestException(
        'Solo el procesador puede cerrar una solicitud en curso',
      );
    }

    const transicionError = assertTransicionProcesamiento({
      estadoActual: row.estado,
      estadoSiguiente: EstadoProcesamiento.pendiente_cierre,
      idOperarioAsignado: null,
      idUsuario: ctx.idUsuario,
      desperdicioKg: dto.kilosMerma,
    });

    if (transicionError) {
      throw new BadRequestException(
        mensajeTransicionProcesamiento(transicionError),
      );
    }

    try {
      const updated = await this.repository.cerrar(row, dto, ctx.idUsuario);
      return this.repository.toResponse(updated);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'STOCK_PROCESAMIENTO_NO_ENCONTRADO'
      ) {
        throw new BadRequestException(
          'No hay stock del primario en zona de procesamiento para registrar la merma',
        );
      }
      if (
        error instanceof Error &&
        error.message === 'STOCK_INSUFICIENTE_MERMA'
      ) {
        throw new BadRequestException(
          'Stock insuficiente en procesamiento para la merma declarada',
        );
      }
      throw error;
    }
  }

  async terminar(
    id: string,
    dto: TenantBodegaProcesamientoQueryDto,
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
      row.estado !== EstadoProcesamiento.pendiente_cierre &&
      row.estado !== EstadoProcesamiento.terminada
    ) {
      throw new BadRequestException(
        'Solo se puede terminar una solicitud en pendiente de cierre o terminada',
      );
    }

    const updated = await this.repository.terminar(row, ctx.idUsuario);
    return this.repository.toResponse(updated);
  }

  async crearOrdenesPostCierre(
    id: string,
    dto: CreateOrdenesPostCierreDto,
    ctx: TenantContext,
  ) {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Solicitud de procesamiento no encontrada');
    }

    if (row.estado !== EstadoProcesamiento.pendiente_cierre) {
      throw new BadRequestException(
        'Las órdenes post-cierre solo aplican en pendiente de cierre',
      );
    }

    return this.repository.crearOrdenesPostCierre(
      row,
      ctx.idUsuario,
      dto.idUbicacionDestinoProcesado,
      dto.idUbicacionDestinoDesperdicio,
    );
  }

  getDesperdicioSugerido(row: SolicitudProcesamientoResponse): number | null {
    return desperdicioKgSugeridoDesdeMerma({
      cantidadPrimario: Number(row.kilosPrimario),
      unidadPrimarioVisualizacion: 'peso',
      perdidaProcesamientoPct: row.perdidaProcesamientoPct
        ? Number(row.perdidaProcesamientoPct)
        : null,
    });
  }
}
