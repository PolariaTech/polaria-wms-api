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
  ApiForbiddenResponse,
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
  ROLES_PROCESAMIENTO_CREAR,
  ROLES_PROCESAMIENTO_EJECUTAR,
  ROLES_PROCESAMIENTO_LECTURA,
} from '../constants/processing.constants';
import {
  AsignarProcesadorDto,
  CambiarEstadoProcesamientoDto,
  CerrarSolicitudProcesamientoDto,
  CreateSolicitudProcesamientoDto,
  ListSolicitudesProcesamientoQueryDto,
} from '../dto/processing.dto';
import { SolicitudProcesamientoResponseDto } from '../dto/processing-response.dto';
import type { SolicitudProcesamientoResponse } from '../interfaces/processing.interfaces';
import { SolicitudProcesamientoService } from '../services/solicitud-procesamiento.service';

@ApiTags(SWAGGER_TAGS.PROCESAMIENTO)
@Controller('procesamiento/solicitudes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class SolicitudProcesamientoController {
  constructor(private readonly service: SolicitudProcesamientoService) {}

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

  @Post()
  @Roles(...ROLES_PROCESAMIENTO_CREAR)
  @UseGuards(SensitiveWriteGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear solicitud de procesamiento',
    description:
      'Crea la solicitud en estado pendiente y encola tarea para el procesador (flujo frio).',
  })
  @ApiCreatedResponse({ type: SolicitudProcesamientoResponseDto })
  @ApiForbiddenResponse()
  create(
    @Body() dto: CreateSolicitudProcesamientoDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    return this.service.create(dto, ctx);
  }

  @Patch(':id/asignar-procesador')
  @Roles(...ROLES_PROCESAMIENTO_ASIGNAR)
  @ApiOperation({ summary: 'Asignar procesador y pasar a en_proceso' })
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
  @ApiOperation({
    summary: 'Cambiar estado de procesamiento',
    description: 'Transiciones: pendiente → en_proceso → pendiente_cierre → terminada.',
  })
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
  @UseGuards(SensitiveWriteGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar procesamiento con merma (procesador)',
    description:
      'Registra kilos secundario, merma y sobrante. Persiste RegistroMerma y movimiento de inventario.',
  })
  @ApiOkResponse({ type: SolicitudProcesamientoResponseDto })
  cerrar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CerrarSolicitudProcesamientoDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudProcesamientoResponse> {
    return this.service.cerrar(id, dto, ctx);
  }
}
