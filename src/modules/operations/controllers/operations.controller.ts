import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TenantCtx } from '../../../core/decorators/tenant-context.decorator';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { Roles } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { SensitiveWriteGuard } from '../../../core/guards/sensitive-write.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import {
  ROLES_ALERTA_EJECUTAR,
  ROLES_ALERTA_GESTION,
  ROLES_LLAMADA_ATENDER,
  ROLES_LLAMADA_CREAR,
  ROLES_OPERACIONES_LECTURA,
  ROLES_OPERARIOS_DISPONIBLES,
  ROLES_ORDEN_TRABAJO_CREAR,
  ROLES_ORDEN_TRABAJO_EJECUTAR,
  ROLES_PRESENCIA_PING,
  ROLES_REPORTES_BODEGA,
  ROLES_TAREA_COLA_ASIGNAR,
  ROLES_TAREA_COLA_COMPLETAR,
} from '../constants/operations.constants';
import { BodegaReportesResumenDto } from '../dto/bodega-reportes-response.dto';
import {
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
  TenantBodegaQueryDto,
} from '../dto/operations.dto';
import {
  AlertaOperativaResponseDto,
  LlamadaOperativaResponseDto,
  OrdenTrabajoResponseDto,
  OperarioDisponibleResponseDto,
  TareaColaResponseDto,
} from '../dto/operations-response.dto';
import { AlertaOperativaRepository } from '../infrastructure/alerta-operativa.repository';
import type {
  AlertaOperativaResponse,
  LlamadaOperativaResponse,
  OperarioDisponibleResponse,
  OrdenTrabajoResponse,
  TareaColaResponse,
} from '../interfaces/operations.interfaces';
import {
  AlertaOperativaService,
  LlamadaOperativaService,
  OrdenTrabajoService,
  TareaColaService,
} from '../services/operations.service';
import { OperariosService } from '../services/operarios.service';
import { BodegaReportesService } from '../services/bodega-reportes.service';
import type { BodegaReportesResumen } from '../infrastructure/bodega-reportes.repository';

@ApiTags(SWAGGER_TAGS.OPERACIONES_ORDENES)
@Controller('operaciones/ordenes-trabajo')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class OrdenTrabajoController {
  constructor(
    private readonly ordenService: OrdenTrabajoService,
    private readonly alertaRepository: AlertaOperativaRepository,
  ) {}

  @Get()
  @Roles(...ROLES_OPERACIONES_LECTURA)
  @ApiOperation({ summary: 'Listar órdenes de trabajo de bodega (a bodega / salida / revisar)' })
  @ApiOkResponse({ type: OrdenTrabajoResponseDto, isArray: true })
  list(
    @Query() query: ListOrdenesTrabajoQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OrdenTrabajoResponse[]> {
    return this.ordenService.list(query, ctx);
  }

  @Get(':id')
  @Roles(...ROLES_OPERACIONES_LECTURA)
  @ApiOperation({ summary: 'Obtener orden de trabajo por id' })
  @ApiOkResponse({ type: OrdenTrabajoResponseDto })
  @ApiNotFoundResponse()
  findById(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OrdenTrabajoResponse> {
    return this.ordenService.findById(id, ctx);
  }

  @Post()
  @Roles(...ROLES_ORDEN_TRABAJO_CREAR)
  @UseGuards(SensitiveWriteGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear orden de trabajo (jefe de bodega)',
    description:
      'Flujos alineados a frio: `a_bodega` (entrada a slot), `a_salida` (despacho) y `revisar` (conteo). ' +
      'Genera automáticamente una tarea en cola para el operario.',
  })
  @ApiCreatedResponse({ type: OrdenTrabajoResponseDto })
  create(
    @Body() dto: CreateOrdenTrabajoDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OrdenTrabajoResponse> {
    return this.ordenService.create(dto, ctx);
  }

  @Post(':id/ejecutar')
  @Roles(...ROLES_ORDEN_TRABAJO_EJECUTAR)
  @UseGuards(SensitiveWriteGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecutar orden de trabajo (operario)',
    description:
      'Marca la orden y su tarea como completadas. Si se envía `idWarehouseState`, transfiere inventario al destino.',
  })
  @ApiOkResponse({ type: OrdenTrabajoResponseDto })
  @ApiConflictResponse({ description: 'Versión de warehouse_state desactualizada' })
  ejecutar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EjecutarOrdenTrabajoDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OrdenTrabajoResponse> {
    return this.ordenService.ejecutar(id, dto, ctx);
  }

  @Post(':id/reportar')
  @Roles(...ROLES_ORDEN_TRABAJO_EJECUTAR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reportar fallo en orden → crea alerta operativa' })
  @ApiCreatedResponse({ type: AlertaOperativaResponseDto })
  reportar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportarOrdenTrabajoDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<AlertaOperativaResponse> {
    return this.ordenService.reportar(id, dto, ctx, this.alertaRepository);
  }
}

@ApiTags(SWAGGER_TAGS.OPERACIONES_TAREAS)
@Controller('operaciones/tareas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class TareaColaController {
  constructor(private readonly tareaService: TareaColaService) {}

  @Get()
  @Roles(...ROLES_OPERACIONES_LECTURA)
  @ApiOperation({ summary: 'Listar tareas pendientes de la cola operativa' })
  @ApiOkResponse({ type: TareaColaResponseDto, isArray: true })
  list(
    @Query() query: ListTareasQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<TareaColaResponse[]> {
    return this.tareaService.list(query, ctx);
  }

  @Patch(':id/asignar')
  @Roles(...ROLES_TAREA_COLA_ASIGNAR)
  @ApiOperation({ summary: 'Asignar tarea a operario o procesador (jefe de bodega)' })
  @ApiOkResponse({ type: TareaColaResponseDto })
  asignar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarTareaDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<TareaColaResponse> {
    return this.tareaService.asignar(id, dto, ctx);
  }

  @Post(':id/completar')
  @Roles(...ROLES_TAREA_COLA_COMPLETAR)
  @UseGuards(SensitiveWriteGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar tarea como completada',
    description:
      'Operario: movimiento/despacho/revisión. Si la tarea tiene orden de trabajo vinculada, ' +
      'ejecuta la transferencia de inventario y completa la OT en una sola transacción. ' +
      'Procesador: procesamiento (sin OT).',
  })
  @ApiOkResponse({ type: TareaColaResponseDto })
  completar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TenantBodegaBodyDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<TareaColaResponse> {
    return this.tareaService.completar(id, dto, ctx);
  }
}

@ApiTags(SWAGGER_TAGS.OPERACIONES_ALERTAS)
@Controller('operaciones/alertas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class AlertaOperativaController {
  constructor(private readonly alertaService: AlertaOperativaService) {}

  @Get()
  @Roles(...ROLES_OPERACIONES_LECTURA)
  @ApiOperation({ summary: 'Listar alertas operativas (temperatura, demora, orden reportada)' })
  @ApiOkResponse({ type: AlertaOperativaResponseDto, isArray: true })
  list(
    @Query() query: ListAlertasQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<AlertaOperativaResponse[]> {
    return this.alertaService.list(query, ctx);
  }

  @Post()
  @Roles(...ROLES_ALERTA_GESTION, ...ROLES_ALERTA_EJECUTAR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear alerta operativa' })
  @ApiCreatedResponse({ type: AlertaOperativaResponseDto })
  create(
    @Body() dto: CreateAlertaDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<AlertaOperativaResponse> {
    return this.alertaService.create(dto, ctx);
  }

  @Patch(':id/asignar')
  @Roles(...ROLES_ALERTA_GESTION)
  @ApiOperation({ summary: 'Asignar alerta a operario (jefe de bodega)' })
  @ApiOkResponse({ type: AlertaOperativaResponseDto })
  asignar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarAlertaDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<AlertaOperativaResponse> {
    return this.alertaService.asignar(id, dto, ctx);
  }

  @Post(':id/cerrar')
  @Roles(...ROLES_ALERTA_GESTION, ...ROLES_ALERTA_EJECUTAR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar alerta operativa' })
  @ApiOkResponse({ type: AlertaOperativaResponseDto })
  cerrar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CerrarAlertaDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<AlertaOperativaResponse> {
    return this.alertaService.cerrar(id, dto, ctx);
  }
}

@ApiTags(SWAGGER_TAGS.OPERACIONES_LLAMADAS)
@Controller('operaciones/llamadas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class LlamadaOperativaController {
  constructor(private readonly llamadaService: LlamadaOperativaService) {}

  @Get()
  @Roles(...ROLES_OPERACIONES_LECTURA)
  @ApiOperation({ summary: 'Listar llamadas al jefe de bodega' })
  @ApiOkResponse({ type: LlamadaOperativaResponseDto, isArray: true })
  list(
    @Query() query: ListAlertasQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<LlamadaOperativaResponse[]> {
    return this.llamadaService.list(query, ctx);
  }

  @Post()
  @Roles(...ROLES_LLAMADA_CREAR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Llamar al jefe de bodega (operario o procesador)',
    description: 'Persiste la llamada como alerta operativa con subtipo `llamada_jefe`.',
  })
  @ApiCreatedResponse({ type: LlamadaOperativaResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  crear(
    @Body() dto: CrearLlamadaDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<LlamadaOperativaResponse> {
    return this.llamadaService.crear(dto, ctx);
  }

  @Post(':id/atender')
  @Roles(...ROLES_LLAMADA_ATENDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar llamada como atendida (jefe de bodega)' })
  @ApiOkResponse({ type: LlamadaOperativaResponseDto })
  @ApiNotFoundResponse()
  atender(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TenantBodegaBodyDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<LlamadaOperativaResponse> {
    return this.llamadaService.atender(id, dto, ctx);
  }
}

@ApiTags(SWAGGER_TAGS.OPERACIONES_REPORTES)
@Controller('operaciones/reportes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class BodegaReportesController {
  constructor(private readonly reportesService: BodegaReportesService) {}

  @Get('bodega')
  @Roles(...ROLES_REPORTES_BODEGA)
  @ApiOperation({
    summary: 'Resumen de reportes operativos de bodega',
    description:
      'Solo lectura. Usado por administrador de bodega y jefe. Incluye ingresos, salidas, movimientos, alertas y merma.',
  })
  @ApiOkResponse({ type: BodegaReportesResumenDto })
  getResumen(
    @Query() query: TenantBodegaQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<BodegaReportesResumen> {
    return this.reportesService.getResumen(query, ctx);
  }
}

@ApiTags(SWAGGER_TAGS.OPERACIONES_OPERARIOS)
@Controller('operaciones')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class OperariosController {
  constructor(private readonly operariosService: OperariosService) {}

  @Get('operarios-disponibles')
  @Roles(...ROLES_OPERARIOS_DISPONIBLES)
  @ApiOperation({
    summary: 'Listar operarios de bodega con carga y disponibilidad',
    description:
      'Incluye todos los operarios asignados a la bodega, ordenados por menos tareas pendientes. ' +
      '`disponible` refleja si la cuenta del operario está activa (`usuario.esta_activo`). ' +
      '`ultimoPing` es informativo (presencia en app) y no determina disponibilidad.',
  })
  @ApiOkResponse({ type: OperarioDisponibleResponseDto, isArray: true })
  @ApiForbiddenResponse()
  listDisponibles(
    @Query() query: TenantBodegaQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OperarioDisponibleResponse[]> {
    return this.operariosService.listDisponibles(query, ctx);
  }
}

@ApiTags(SWAGGER_TAGS.OPERACIONES_OPERARIOS)
@Controller('operaciones/presencia')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class PresenciaController {
  constructor(private readonly operariosService: OperariosService) {}

  @Post('ping')
  @Roles(...ROLES_PRESENCIA_PING)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Heartbeat de presencia operativa (operario)',
    description:
      'Mantiene al operario como disponible mientras la app envía pings periódicos (ventana de 2 minutos).',
  })
  @ApiForbiddenResponse()
  ping(
    @Body() dto: TenantBodegaBodyDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<void> {
    return this.operariosService.ping(dto, ctx);
  }
}
