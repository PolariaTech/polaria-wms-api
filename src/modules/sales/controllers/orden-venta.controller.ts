import {
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
import { TenantGuard } from '../../../core/guards/tenant.guard';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import {
  ROLES_OV_ESCRITURA,
  ROLES_OV_LECTURA,
} from '../constants/orden-venta.constants';
import { ListOrdenesVentaQueryDto } from '../dto/list-ordenes-venta-query.dto';
import { OrdenVentaEmitirResponseDto } from '../dto/orden-venta-response.dto';
import type { OrdenVentaEmitirResponse } from '../interfaces/orden-venta.interfaces';
import { OrdenVentaService } from '../services/orden-venta.service';

@ApiTags(SWAGGER_TAGS.VENTAS_OV)
@Controller('ventas/ordenes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class OrdenVentaController {
  constructor(private readonly ordenService: OrdenVentaService) {}

  @Get()
  @Roles(...ROLES_OV_LECTURA)
  @ApiOperation({
    summary: 'Listar órdenes de venta',
    description:
      'Con `paraSalida=true` devuelve solo OVs confirmadas pendientes de registrar salida (picker del jefe).',
  })
  @ApiOkResponse({ type: OrdenVentaEmitirResponseDto, isArray: true })
  list(
    @Query() query: ListOrdenesVentaQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OrdenVentaEmitirResponse[]> {
    return this.ordenService.list(query, ctx);
  }

  @Post(':id/emitir')
  @Roles(...ROLES_OV_ESCRITURA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Emitir orden de venta (borrador → confirmada)',
    description:
      'Reserva stock en almacenamiento (FIFO), crea órdenes de trabajo y tareas en cola para despacho.',
  })
  @ApiOkResponse({ type: OrdenVentaEmitirResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'No se encontró la orden de venta' })
  @ApiConflictResponse({
    description: 'Estado inválido, sin líneas o stock insuficiente',
  })
  emitir(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OrdenVentaEmitirResponse> {
    return this.ordenService.emitir(id, ctx);
  }
}
