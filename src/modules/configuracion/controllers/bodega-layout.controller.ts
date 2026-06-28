import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
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
import { BootstrapLayoutResponseDto } from '../dto/bootstrap-layout-response.dto';
import type { BootstrapLayoutResult } from '../interfaces/bodega-layout.interfaces';
import { BodegaLayoutBootstrapService } from '../services/bodega-layout-bootstrap.service';

@ApiTags(SWAGGER_TAGS.CONFIGURACION_BODEGAS)
@Controller('configuracion/bodegas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(WmsRol.configurador, WmsRol.administrador_cuenta)
@ApiBearerAuth('access-token')
export class BodegaLayoutController {
  constructor(
    private readonly bootstrapService: BodegaLayoutBootstrapService,
  ) {}

  @Post(':idBodega/bootstrap-layout')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bootstrap de layout de bodega interna',
    description:
      'Genera tipos de ubicación INGRESO y ALMACEN, zona General y slots SLOT-001..N ' +
      'según capacidad_slots de la bodega (1–500). Idempotente: retorna 409 si ya existen ubicaciones. ' +
      'Roles: configurador (cualquier tenant) o administrador_cuenta (solo su cuenta).',
  })
  @ApiParam({
    name: 'idBodega',
    description: 'UUID de la bodega interna',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiCreatedResponse({ type: BootstrapLayoutResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Rol no autorizado, bodega inactiva o fuera del tenant',
  })
  @ApiNotFoundResponse({ description: 'Bodega no encontrada' })
  @ApiConflictResponse({
    description: 'La bodega ya tiene ubicaciones configuradas',
  })
  bootstrapLayout(
    @Param('idBodega', ParseUUIDPipe) idBodega: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<BootstrapLayoutResult> {
    return this.bootstrapService.bootstrapLayout(idBodega, ctx);
  }
}
