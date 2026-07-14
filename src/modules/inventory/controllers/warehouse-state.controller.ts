import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
  ROLES_INVENTARIO_LOCK,
  ROLES_INVENTARIO_LECTURA,
} from '../constants/inventory.constants';
import {
  ListWarehouseStateQueryDto,
  LockWarehouseStateDto,
} from '../dto/warehouse-state.dto';
import { WarehouseStateResponseDto } from '../dto/warehouse-state-response.dto';
import type { WarehouseStateResponse } from '../interfaces/warehouse-state.interfaces';
import { WarehouseStateService } from '../services/warehouse-state.service';

@ApiTags(SWAGGER_TAGS.INVENTARIO)
@Controller('inventario/warehouse-state')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class WarehouseStateController {
  constructor(private readonly warehouseStateService: WarehouseStateService) {}

  @Get()
  @Roles(...ROLES_INVENTARIO_LECTURA)
  @ApiOperation({ summary: 'Listar posiciones warehouse_state de una bodega' })
  @ApiOkResponse({ type: WarehouseStateResponseDto, isArray: true })
  list(
    @Query() query: ListWarehouseStateQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<WarehouseStateResponse[]> {
    return this.warehouseStateService.list(query, ctx);
  }

  @Post(':id/lock')
  @Roles(...ROLES_INVENTARIO_LOCK)
  @UseGuards(SensitiveWriteGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bloquear posición del mapa (locking en tiempo real)',
  })
  @ApiOkResponse({ type: WarehouseStateResponseDto })
  @ApiConflictResponse({ description: 'Ya bloqueada o versión desactualizada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'Fuera del tenant o rol no autorizado' })
  lock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LockWarehouseStateDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<WarehouseStateResponse> {
    return this.warehouseStateService.lock(id, dto, ctx);
  }

  @Post(':id/unlock')
  @Roles(...ROLES_INVENTARIO_LOCK)
  @UseGuards(SensitiveWriteGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liberar bloqueo de posición',
    description:
      'El titular del lock o jefe/admin/configurador puede forzar unlock.',
  })
  @ApiOkResponse({ type: WarehouseStateResponseDto })
  @ApiNotFoundResponse({ description: 'Posición no encontrada' })
  unlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LockWarehouseStateDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<WarehouseStateResponse> {
    return this.warehouseStateService.unlock(id, dto, ctx);
  }
}
