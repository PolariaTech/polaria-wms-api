import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TenantCtx } from '../../../core/decorators/tenant-context.decorator';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { Roles } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { ROLES_INVENTARIO_LECTURA } from '../constants/inventory.constants';
import {
  ListMovimientosInventarioQueryDto,
  MovimientoInventarioResponseDto,
} from '../dto/movimiento-inventario.dto';
import type { MovimientoInventarioResponse } from '../interfaces/movimiento-inventario.interfaces';
import { MovimientoInventarioService } from '../services/movimiento-inventario.service';

@ApiTags(SWAGGER_TAGS.INVENTARIO)
@Controller('inventario/movimientos')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class MovimientoInventarioController {
  constructor(private readonly service: MovimientoInventarioService) {}

  @Get()
  @Roles(...ROLES_INVENTARIO_LECTURA)
  @ApiOperation({ summary: 'Historial de movimientos de inventario (POL-106)' })
  @ApiOkResponse({ type: MovimientoInventarioResponseDto, isArray: true })
  list(
    @Query() query: ListMovimientosInventarioQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<MovimientoInventarioResponse[]> {
    return this.service.list(query, ctx);
  }
}
