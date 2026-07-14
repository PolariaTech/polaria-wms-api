import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WmsRol } from '../../../generated/prisma/client';
import { TenantCtx } from '../../../core/decorators/tenant-context.decorator';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { Roles } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { ROLES_INTEGRACION_ESCRITURA } from '../constants/integration.constants';
import { CreateSolicitudIntegracionDto } from '../dto/create-solicitud-integracion.dto';
import { SolicitudIntegracionResponseDto } from '../dto/solicitud-integracion-response.dto';
import type { SolicitudIntegracionResponse } from '../interfaces/solicitud-integracion.interfaces';
import { SolicitudIntegracionService } from '../services/solicitud-integracion.service';

@ApiTags(SWAGGER_TAGS.INTEGRACION)
@Controller('integracion/solicitudes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class SolicitudIntegracionController {
  constructor(private readonly service: SolicitudIntegracionService) {}

  @Post()
  @Roles(...ROLES_INTEGRACION_ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear solicitud de integración (operador de cuenta)',
    description:
      'Registra una solicitud de integración para una bodega externa vinculada. ' +
      'Visible para el configurador en GET /configurador/integracion/solicitudes.',
  })
  @ApiCreatedResponse({ type: SolicitudIntegracionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Sin permisos o cuenta fuera del tenant',
  })
  create(
    @Body() dto: CreateSolicitudIntegracionDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudIntegracionResponse> {
    return this.service.create(dto, ctx);
  }

  @Get()
  @Roles(...ROLES_INTEGRACION_ESCRITURA)
  @ApiOperation({ summary: 'Listar solicitudes de integración del tenant' })
  @ApiOkResponse({ type: SolicitudIntegracionResponseDto, isArray: true })
  list(
    @TenantCtx() ctx: TenantContext,
  ): Promise<SolicitudIntegracionResponse[]> {
    return this.service.listForTenant(ctx);
  }
}

@ApiTags(SWAGGER_TAGS.INTEGRACION)
@Controller('configurador/integracion/solicitudes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(WmsRol.configurador)
@ApiBearerAuth('access-token')
export class ConfiguradorIntegracionController {
  constructor(private readonly service: SolicitudIntegracionService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar todas las solicitudes de integración (configurador)',
    description:
      'Bandeja de solicitudes enviadas por operadores de cuenta desde bodega externa.',
  })
  @ApiOkResponse({ type: SolicitudIntegracionResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'Solo configurador' })
  list(): Promise<SolicitudIntegracionResponse[]> {
    return this.service.listForConfigurador();
  }
}
