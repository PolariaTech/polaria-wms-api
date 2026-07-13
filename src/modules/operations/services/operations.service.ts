import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoOrdenTrabajo,
  EstadoTarea,
  TipoAlerta,
  TipoTarea,
  WmsRol,
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
import { OperariosService } from './operarios.service';
import { mapEjecutarOrdenError } from '../utils/map-ejecutar-orden-error';
import { mapOrdenVentaOvError } from '../../sales/utils/map-orden-venta-ov-error';
import type {
  AlertaOperativaResponse,
  LlamadaOperativaResponse,
  OrdenTrabajoResponse,
  TareaColaResponse,
} from '../interfaces/operations.interfaces';

@Injectable()
export class OrdenTrabajoService {
  constructor(
    private readonly repository: OrdenTrabajoRepository,
    private readonly operariosService: OperariosService,
  ) {}

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

    if (
      dto.tipoFlujo === 'bodega_a_bodega' &&
      (!dto.idUbicacionOrigen || !dto.idUbicacionDestino)
    ) {
      throw new BadRequestException(
        'Las transferencias bodega a bodega requieren origen y destino',
      );
    }

    if (dto.idAsignado) {
      await this.operariosService.assertOperarioAsignable(
        dto.idAsignado,
        dto.codigoCuenta,
        dto.idBodega,
      );
    }

    try {
      const orden = await this.repository.create(dto, ctx.idUsuario);
      return this.repository.toResponse(orden);
    } catch (error) {
      mapOrdenVentaOvError(error);
    }
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
      mapEjecutarOrdenError(error);
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
  constructor(
    private readonly repository: TareaColaRepository,
    private readonly ordenTrabajoRepository: OrdenTrabajoRepository,
  ) {}

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

    if (tarea.estado === EstadoTarea.cancelada) {
      throw new BadRequestException('La tarea ya está cerrada');
    }

    if (
      tarea.codigoCuenta !== dto.codigoCuenta ||
      tarea.idBodega !== dto.idBodega
    ) {
      throw new BadRequestException('La tarea no pertenece al tenant indicado');
    }

    this.assertPuedeCompletarTarea(tarea.tipo, ctx.idRol);
    this.assertOperarioAsignadoATarea(tarea.idAsignado, ctx);

    if (tarea.tipo === TipoTarea.procesamiento) {
      const updated = await this.repository.completar(idTarea, ctx.idUsuario);
      return this.repository.toResponse(updated);
    }

    if (!tarea.idOrdenTrabajo) {
      const updated = await this.repository.completar(idTarea, ctx.idUsuario);
      return this.repository.toResponse(updated);
    }

    const orden = await this.ordenTrabajoRepository.findById(tarea.idOrdenTrabajo);

    if (!orden) {
      throw new NotFoundException('Orden de trabajo vinculada no encontrada');
    }

    if (
      orden.codigoCuenta !== dto.codigoCuenta ||
      orden.idBodega !== dto.idBodega
    ) {
      throw new BadRequestException('La orden no pertenece al tenant indicado');
    }

    if (
      orden.estado !== EstadoOrdenTrabajo.planificada &&
      orden.estado !== EstadoOrdenTrabajo.en_proceso
    ) {
      throw new BadRequestException('La orden no está pendiente de ejecución');
    }

    try {
      await this.ordenTrabajoRepository.ejecutar(
        orden,
        { codigoCuenta: dto.codigoCuenta, idBodega: dto.idBodega },
        ctx.idUsuario,
        { autoResolverStock: true },
      );
    } catch (error) {
      mapEjecutarOrdenError(error);
    }

    const updated = await this.repository.findById(idTarea);

    if (!updated) {
      throw new NotFoundException('Tarea no encontrada');
    }

    return this.repository.toResponse(updated);
  }

  private assertOperarioAsignadoATarea(
    idAsignado: string | null,
    ctx: TenantContext,
  ): void {
    if (ctx.idRol === WmsRol.configurador) {
      return;
    }

    if (idAsignado && idAsignado !== ctx.idUsuario) {
      throw new ForbiddenException('Esta tarea está asignada a otro operario');
    }
  }

  private assertPuedeCompletarTarea(tipo: TipoTarea, idRol: WmsRol): void {
    if (idRol === WmsRol.configurador) {
      return;
    }

    if (tipo === TipoTarea.procesamiento) {
      if (
        idRol !== WmsRol.procesador &&
        idRol !== WmsRol.operario
      ) {
        throw new ForbiddenException(
          'Solo el procesador u operario puede completar tareas de procesamiento',
        );
      }
      return;
    }

    if (idRol !== WmsRol.operario) {
      throw new ForbiddenException(
        'Solo el operario puede completar esta tarea',
      );
    }
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
