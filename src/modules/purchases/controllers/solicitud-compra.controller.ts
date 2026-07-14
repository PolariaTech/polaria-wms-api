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
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TenantCtx } from '../../../core/decorators/tenant-context.decorator';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { Roles } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import {
  ROLES_SOL_APROBACION,
  ROLES_SOL_ESCRITURA,
  ROLES_SOL_LECTURA,
} from '../constants/solicitud-compra.constants';
import { CreateSolicitudCompraDto } from '../dto/create-solicitud-compra.dto';
import { ListSolicitudesQueryDto } from '../dto/list-solicitudes-query.dto';
import { RechazarSolicitudDto } from '../dto/rechazar-solicitud.dto';
import { SolicitudCompraResponseDto } from '../dto/solicitud-compra-response.dto';
import { OrdenCompraResponseDto } from '../dto/orden-compra-response.dto';
import { UpdateSolicitudCompraDto } from '../dto/update-solicitud-compra.dto';
import type { SolicitudCompraResponse } from '../interfaces/solicitud-compra.interfaces';
import type { OrdenCompraResponse } from '../interfaces/orden-compra.interfaces';
import { OrdenCompraService } from '../services/orden-compra.service';
import { SolicitudCompraService } from '../services/solicitud-compra.service';

@ApiTags(SWAGGER_TAGS.COMPRAS_SOL)
@Controller('compras/solicitudes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class SolicitudCompraController {
  constructor(
    private readonly solicitudService: SolicitudCompraService,
    private readonly ordenService: OrdenCompraService,
  ) {}

  @Post()
  @Roles(...ROLES_SOL_ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear solicitud de compra en borrador' })
  @ApiCreatedResponse({ type: SolicitudCompraResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Sin permisos o entidades fuera del tenant',
  })
  create(
    @Body() dto: CreateSolicitudCompraDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    return this.solicitudService.create(dto, ctx);
  }

  @Get()
  @Roles(...ROLES_SOL_LECTURA)
  @ApiOperation({ summary: 'Listar solicitudes de compra del tenant' })
  @ApiOkResponse({ type: SolicitudCompraResponseDto, isArray: true })
  list(
    @Query() query: ListSolicitudesQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudCompraResponse[]> {
    return this.solicitudService.list(query, ctx);
  }

  @Get(':id')
  @Roles(...ROLES_SOL_LECTURA)
  @ApiOperation({ summary: 'Obtener solicitud de compra por id' })
  @ApiOkResponse({ type: SolicitudCompraResponseDto })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada' })
  findById(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    return this.solicitudService.findById(id, ctx);
  }

  @Patch(':id')
  @Roles(...ROLES_SOL_ESCRITURA)
  @ApiOperation({ summary: 'Editar solicitud en borrador' })
  @ApiOkResponse({ type: SolicitudCompraResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSolicitudCompraDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    return this.solicitudService.update(id, dto, ctx);
  }

  @Post(':id/enviar-aprobacion')
  @Roles(...ROLES_SOL_ESCRITURA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar solicitud a aprobación' })
  @ApiOkResponse({ type: SolicitudCompraResponseDto })
  enviarAprobacion(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    return this.solicitudService.enviarAprobacion(id, ctx);
  }

  @Post(':id/aprobar')
  @Roles(...ROLES_SOL_APROBACION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprobar solicitud de compra' })
  @ApiOkResponse({ type: SolicitudCompraResponseDto })
  aprobar(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    return this.solicitudService.aprobar(id, ctx);
  }

  @Post(':id/rechazar')
  @Roles(...ROLES_SOL_APROBACION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechazar solicitud de compra' })
  @ApiOkResponse({ type: SolicitudCompraResponseDto })
  rechazar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RechazarSolicitudDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    return this.solicitudService.rechazar(id, dto, ctx);
  }

  @Post(':id/cancelar')
  @Roles(...ROLES_SOL_ESCRITURA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar solicitud de compra' })
  @ApiOkResponse({ type: SolicitudCompraResponseDto })
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    return this.solicitudService.cancelar(id, ctx);
  }

  @Post(':id/convertir-oc')
  @Roles(...ROLES_SOL_ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Convertir solicitud aprobada en orden de compra',
  })
  @ApiCreatedResponse({ type: OrdenCompraResponseDto })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada' })
  convertirOc(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OrdenCompraResponse> {
    return this.ordenService.convertirDesdeSolicitud(id, ctx);
  }
}
