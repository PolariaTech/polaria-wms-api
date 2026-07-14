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
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
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
  ROLES_PROCESAMIENTO_ASIGNAR,
  ROLES_PROCESAMIENTO_ASIGNAR_OPERARIO,
  ROLES_PROCESAMIENTO_CREAR,
  ROLES_PROCESAMIENTO_EJECUTAR,
  ROLES_PROCESAMIENTO_INICIAR,
  ROLES_PROCESAMIENTO_LECTURA,
  ROLES_PROCESAMIENTO_POST_CIERRE,
} from '../constants/processing.constants';
import {
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
import { SolicitudProcesamientoResponseDto } from '../dto/processing-response.dto';
import type { SolicitudProcesamientoResponse } from '../interfaces/processing.interfaces';
import { SolicitudProcesamientoRepository } from '../infrastructure/solicitud-procesamiento.repository';
import { SolicitudProcesamientoService } from '../services/solicitud-procesamiento.service';

@ApiTags(SWAGGER_TAGS.PROCESAMIENTO)
@Controller('procesamiento/solicitudes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class SolicitudProcesamientoController {
  constructor(
    private readonly service: SolicitudProcesamientoService,
    private readonly repository: SolicitudProcesamientoRepository,
  ) {}

  @Get()
  @Roles(...ROLES_PROCESAMIENTO_LECTURA)
  @ApiOperation({ summary: 'Listar solicitudes de procesamiento' })
  @ApiOkResponse({ type: SolicitudProcesamientoResponseDto, isArray: true })
  list(
    @Query() query: ListSolicitudesProcesamientoQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse[]> {
    return this.service.list(query, ctx);
  }

  @Get(':id')
  @Roles(...ROLES_PROCESAMIENTO_LECTURA)
  @ApiOperation({ summary: 'Obtener solicitud de procesamiento por id' })
  @ApiOkResponse({ type: SolicitudProcesamientoResponseDto })
  @ApiNotFoundResponse()
  findById(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    return this.service.findById(id, ctx);
  }

  @Get(':id/desperdicio-sugerido')
  @Roles(...ROLES_PROCESAMIENTO_LECTURA)
  @ApiOperation({
    summary: 'Kg merma sugeridos según % catálogo (frio)',
  })
  async desperdicioSugerido(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<{ desperdicioKgSugerido: number | null }> {
    const row = await this.service.findById(id, ctx);
    return {
      desperdicioKgSugerido: this.service.getDesperdicioSugerido(row),
    };
  }

  @Post()
  @Roles(...ROLES_PROCESAMIENTO_CREAR)
  @UseGuards(SensitiveWriteGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear solicitud (Iniciado)',
    description:
      'Calcula estimado con regla de tres y % merma del catálogo (frio).',
  })
  @ApiCreatedResponse({ type: SolicitudProcesamientoResponseDto })
  create(
    @Body() dto: CreateSolicitudProcesamientoDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    return this.service.create(dto, ctx);
  }

  @Patch(':id/asignar-operario')
  @Roles(...ROLES_PROCESAMIENTO_ASIGNAR_OPERARIO)
  @ApiOperation({ summary: 'Jefe asigna operario (permanece pendiente)' })
  @ApiOkResponse({ type: SolicitudProcesamientoResponseDto })
  asignarOperario(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarOperarioDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    return this.service.asignarOperario(id, dto, ctx);
  }

  @Post(':id/iniciar')
  @Roles(...ROLES_PROCESAMIENTO_INICIAR)
  @UseGuards(SensitiveWriteGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Operario pasa a en curso',
    description:
      'Descuenta primario del mapa, calcula sobranteKg y reasigna al procesador.',
  })
  @ApiOkResponse({ type: SolicitudProcesamientoResponseDto })
  iniciar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IniciarProcesamientoDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    return this.service.iniciar(id, dto, ctx);
  }

  @Patch(':id/asignar-procesador')
  @Roles(...ROLES_PROCESAMIENTO_ASIGNAR)
  @ApiOperation({ summary: 'Pre-asignar procesador (sin cambiar estado)' })
  @ApiOkResponse({ type: SolicitudProcesamientoResponseDto })
  asignarProcesador(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarProcesadorDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    return this.service.asignarProcesador(id, dto, ctx);
  }

  @Patch(':id/estado')
  @Roles(...ROLES_PROCESAMIENTO_EJECUTAR)
  @ApiOperation({ summary: 'Transición manual con reglas frio' })
  @ApiOkResponse({ type: SolicitudProcesamientoResponseDto })
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoProcesamientoDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    return this.service.cambiarEstado(id, dto, ctx);
  }

  @Post(':id/cerrar')
  @Roles(...ROLES_PROCESAMIENTO_EJECUTAR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Procesador cierra → pendiente_cierre',
    description: 'Registra desperdicioKg (merma) como en frio.',
  })
  @ApiOkResponse({ type: SolicitudProcesamientoResponseDto })
  cerrar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CerrarSolicitudProcesamientoDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    return this.service.cerrar(id, dto, ctx);
  }

  @Post(':id/ordenes-post-cierre')
  @Roles(...ROLES_PROCESAMIENTO_POST_CIERRE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crea OT procesado/sobrante hacia almacén (procesador o jefe)',
  })
  crearOrdenesPostCierre(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOrdenesPostCierreDto,
    @TenantCtx() ctx: TenantContext,
  ) {
    return this.service.crearOrdenesPostCierre(id, dto, ctx);
  }

  @Post(':id/ordenes/:idOrden/aplicar')
  @Roles(...ROLES_PROCESAMIENTO_INICIAR, ...ROLES_PROCESAMIENTO_EJECUTAR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Operario aplica OT de procesado o sobrante al mapa',
  })
  async aplicarOrden(
    @Param('idOrden', ParseUUIDPipe) idOrden: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<{ ok: true }> {
    await this.repository.ejecutarOtProcesamiento(idOrden, ctx.idUsuario);
    return { ok: true };
  }

  @Post(':id/terminar')
  @Roles(...ROLES_PROCESAMIENTO_ASIGNAR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar terminada tras ubicar en mapa' })
  @ApiOkResponse({ type: SolicitudProcesamientoResponseDto })
  terminar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TenantBodegaProcesamientoQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    return this.service.terminar(id, dto, ctx);
  }
}
