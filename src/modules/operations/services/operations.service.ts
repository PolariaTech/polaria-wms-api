import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoOrdenTrabajo,
  EstadoTarea,
  TipoAlerta,
} from '../../../generated/prisma/client';
import {
  applyTenantFilter,
  assertOperationalTenantScope,
} from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type {
  AsignarAlertaDto,
  AsignarTareaDto,
  CerrarAlertaDto,
  CreateAlertaDto,
  CreateOrdenTrabajoDto,
  CrearLlamadaDto,
  EjecutarOrdenTrabajoDto,
  ListAlertasQueryDto,
  ListOrdenesTrabajoQueryDto,
  ListTareasQueryDto,
  ReportarOrdenTrabajoDto,
  TenantBodegaBodyDto,
} from '../dto/operations.dto';
import { AlertaOperativaRepository } from '../infrastructure/alerta-operativa.repository';
import { OrdenTrabajoRepository } from '../infrastructure/orden-trabajo.repository';
import { TareaColaRepository } from '../infrastructure/tarea-cola.repository';
import type {
  AlertaOperativaResponse,
  LlamadaOperativaResponse,
  OrdenTrabajoResponse,
  TareaColaResponse,
} from '../interfaces/operations.interfaces';

@Injectable()
export class OrdenTrabajoService {
  constructor(private readonly repository: OrdenTrabajoRepository) {}

  async list(
    query: ListOrdenesTrabajoQueryDto,
    ctx: TenantContext,
  ): Promise<OrdenTrabajoResponse[]> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: query.codigoCuenta,
      idBodega: query.idBodega,
    });

    const where = applyTenantFilter(
      {
        codigoCuenta: query.codigoCuenta,
        idBodega: query.idBodega,
        ...(query.estado ? { estado: query.estado as EstadoOrdenTrabajo } : {}),
        ...(query.tipoFlujo
          ? { observaciones: { startsWith: `flujo:${query.tipoFlujo}` } }
          : {}),
      },
      ctx,
    );

    const rows = await this.repository.list(where);
    return rows.map((row) => this.repository.toResponse(row));
  }

  async findById(id: string, ctx: TenantContext): Promise<OrdenTrabajoResponse> {
    const orden = await this.repository.findById(id);

    if (!orden) {
      throw new NotFoundException('Orden de trabajo no encontrada');
    }

    assertOperationalTenantScope(ctx, {
      codigoCuenta: orden.codigoCuenta,
      idBodega: orden.idBodega,
    });

    return this.repository.toResponse(orden);
  }

  async create(
    dto: CreateOrdenTrabajoDto,
    ctx: TenantContext,
  ): Promise<OrdenTrabajoResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    if (dto.tipoFlujo === 'a_bodega' && !dto.idUbicacionDestino) {
      throw new BadRequestException(
        'Las órdenes a bodega requieren idUbicacionDestino',
      );
    }

    if (dto.tipoFlujo === 'a_salida' && !dto.idUbicacionOrigen) {
      throw new BadRequestException(
        'Las órdenes a salida requieren idUbicacionOrigen',
      );
    }

    const orden = await this.repository.create(dto, ctx.idUsuario);
    return this.repository.toResponse(orden);
  }

  async ejecutar(
    idOrdenTrabajo: string,
    dto: EjecutarOrdenTrabajoDto,
    ctx: TenantContext,
  ): Promise<OrdenTrabajoResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const orden = await this.repository.findById(idOrdenTrabajo);

    if (!orden) {
      throw new NotFoundException('Orden de trabajo no encontrada');
    }

    if (orden.codigoCuenta !== dto.codigoCuenta || orden.idBodega !== dto.idBodega) {
      throw new BadRequestException('La orden no pertenece al tenant indicado');
    }

    if (
      orden.estado !== EstadoOrdenTrabajo.planificada &&
      orden.estado !== EstadoOrdenTrabajo.en_proceso
    ) {
      throw new BadRequestException('La orden no está pendiente de ejecución');
    }

    try {
      const updated = await this.repository.ejecutar(orden, dto, ctx.idUsuario);
      return this.repository.toResponse(updated);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'WAREHOUSE_STATE_NOT_FOUND') {
          throw new NotFoundException('Posición de inventario no encontrada');
        }
        if (error.message === 'WAREHOUSE_STATE_VERSION_CONFLICT') {
          throw new ConflictException('La posición fue modificada por otro usuario');
        }
      }
      throw error;
    }
  }

  async reportar(
    idOrdenTrabajo: string,
    dto: ReportarOrdenTrabajoDto,
    ctx: TenantContext,
    alertaRepository: AlertaOperativaRepository,
  ): Promise<AlertaOperativaResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const orden = await this.repository.findById(idOrdenTrabajo);

    if (!orden) {
      throw new NotFoundException('Orden de trabajo no encontrada');
    }

    const alerta = await alertaRepository.create({
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
      tipo: TipoAlerta.orden_reportada,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      idOrdenTrabajo: orden.idOrdenTrabajo,
    });

    return alertaRepository.toResponse(alerta);
  }
}

@Injectable()
export class TareaColaService {
  constructor(private readonly repository: TareaColaRepository) {}

  async list(
    query: ListTareasQueryDto,
    ctx: TenantContext,
  ): Promise<TareaColaResponse[]> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: query.codigoCuenta,
      idBodega: query.idBodega,
    });

    const where = applyTenantFilter(
      {
        codigoCuenta: query.codigoCuenta,
        idBodega: query.idBodega,
        ...(query.estado ? { estado: query.estado as EstadoTarea } : {}),
        ...(query.idAsignado ? { idAsignado: query.idAsignado } : {}),
      },
      ctx,
    );

    const rows = await this.repository.list(where);
    return rows.map((row) => this.repository.toResponse(row));
  }

  async asignar(
    idTarea: string,
    dto: AsignarTareaDto,
    ctx: TenantContext,
  ): Promise<TareaColaResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const tarea = await this.repository.findById(idTarea);

    if (!tarea) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (tarea.estado === EstadoTarea.completada || tarea.estado === EstadoTarea.cancelada) {
      throw new BadRequestException('La tarea ya está cerrada');
    }

    const updated = await this.repository.asignar(idTarea, dto.idAsignado ?? ctx.idUsuario);
    return this.repository.toResponse(updated);
  }

  async completar(
    idTarea: string,
    dto: TenantBodegaBodyDto,
    ctx: TenantContext,
  ): Promise<TareaColaResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const tarea = await this.repository.findById(idTarea);

    if (!tarea) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (tarea.estado === EstadoTarea.completada) {
      throw new BadRequestException('La tarea ya está completada');
    }

    const updated = await this.repository.completar(idTarea, ctx.idUsuario);
    return this.repository.toResponse(updated);
  }
}

@Injectable()
export class AlertaOperativaService {
  constructor(private readonly repository: AlertaOperativaRepository) {}

  async list(
    query: ListAlertasQueryDto,
    ctx: TenantContext,
  ): Promise<AlertaOperativaResponse[]> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: query.codigoCuenta,
      idBodega: query.idBodega,
    });

    const where = applyTenantFilter(
      {
        codigoCuenta: query.codigoCuenta,
        idBodega: query.idBodega,
        ...(query.estado ? { estado: query.estado as 'abierta' | 'cerrada' } : {}),
        ...(query.tipo ? { tipo: query.tipo as TipoAlerta } : {}),
      },
      ctx,
    );

    const rows = await this.repository.list(where);
    return rows.map((row) => this.repository.toResponse(row));
  }

  async create(
    dto: CreateAlertaDto,
    ctx: TenantContext,
  ): Promise<AlertaOperativaResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const alerta = await this.repository.create({
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
      tipo: dto.tipo as TipoAlerta,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      idUbicacion: dto.idUbicacion,
      idOrdenTrabajo: dto.idOrdenTrabajo,
    });

    return this.repository.toResponse(alerta);
  }

  async asignar(
    idAlerta: string,
    dto: AsignarAlertaDto,
    ctx: TenantContext,
  ): Promise<AlertaOperativaResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const alerta = await this.repository.findById(idAlerta);

    if (!alerta) {
      throw new NotFoundException('Alerta no encontrada');
    }

    const updated = await this.repository.asignar(idAlerta, dto.idResponsable);
    return this.repository.toResponse(updated);
  }

  async cerrar(
    idAlerta: string,
    dto: CerrarAlertaDto,
    ctx: TenantContext,
  ): Promise<AlertaOperativaResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const alerta = await this.repository.findById(idAlerta);

    if (!alerta) {
      throw new NotFoundException('Alerta no encontrada');
    }

    const updated = await this.repository.cerrar(idAlerta, dto.motivoCierre);
    return this.repository.toResponse(updated);
  }
}

@Injectable()
export class LlamadaOperativaService {
  constructor(private readonly repository: AlertaOperativaRepository) {}

  async list(
    query: ListAlertasQueryDto,
    ctx: TenantContext,
  ): Promise<LlamadaOperativaResponse[]> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: query.codigoCuenta,
      idBodega: query.idBodega,
    });

    const where = applyTenantFilter(
      {
        codigoCuenta: query.codigoCuenta,
        idBodega: query.idBodega,
        ...(query.estado === 'abierta'
          ? { estado: 'abierta' as const }
          : query.estado === 'cerrada'
            ? { estado: 'cerrada' as const }
            : {}),
      },
      ctx,
    );

    const rows = await this.repository.listLlamadas(where);
    return rows.map((row) => this.repository.toLlamadaResponse(row));
  }

  async crear(
    dto: CrearLlamadaDto,
    ctx: TenantContext,
  ): Promise<LlamadaOperativaResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const fromRol = ctx.idRol;
    const defaultMessage =
      fromRol === 'procesador' ? 'Llamado del procesador' : 'Llamado del operario';

    const row = await this.repository.crearLlamada({
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
      idSolicitante: ctx.idUsuario,
      fromRol,
      message: dto.message?.trim() || defaultMessage,
    });

    return this.repository.toLlamadaResponse(row);
  }

  async atender(
    idLlamada: string,
    dto: TenantBodegaBodyDto,
    ctx: TenantContext,
  ): Promise<LlamadaOperativaResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    try {
      const updated = await this.repository.atenderLlamada(idLlamada, ctx.idUsuario);
      return this.repository.toLlamadaResponse(updated);
    } catch (error) {
      if (error instanceof Error && error.message === 'LLAMADA_NOT_FOUND') {
        throw new NotFoundException('Llamada no encontrada');
      }
      throw error;
    }
  }
}
