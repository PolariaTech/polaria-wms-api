import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
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
import { ROLES_OC_LECTURA } from '../constants/orden-compra.constants';
import { BodegaDestinoResponseDto } from '../dto/bodega-destino-response.dto';
import { ListBodegasDestinoQueryDto } from '../dto/list-bodegas-destino-query.dto';
import type { BodegaDestinoResponse } from '../interfaces/bodega-destino.interfaces';
import { BodegaDestinoService } from '../services/bodega-destino.service';

@ApiTags(SWAGGER_TAGS.COMPRAS_OC)
@Controller('compras/bodegas-destino')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class BodegaDestinoController {
  constructor(private readonly bodegaDestinoService: BodegaDestinoService) {}

  @Get()
  @Roles(...ROLES_OC_LECTURA)
  @ApiOperation({
    summary: 'Listar bodegas destino disponibles para órdenes de compra',
    description:
      'Devuelve bodegas activas de la cuenta indicada, del tipo solicitado (interna/externa), ' +
      'con al menos un slot libre. El filtro es por codigoCuenta (cuenta activa), no por toda la empresa.',
  })
  @ApiOkResponse({ type: BodegaDestinoResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Sin permisos o cuenta fuera del tenant',
  })
  list(
    @Query() query: ListBodegasDestinoQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<BodegaDestinoResponse[]> {
    return this.bodegaDestinoService.listBodegasDestino(query, ctx);
  }
}
