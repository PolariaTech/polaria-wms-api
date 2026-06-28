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
  ROLES_OC_ESCRITURA,
  ROLES_OC_LECTURA,
} from '../constants/orden-compra.constants';
import { CreateOrdenCompraDto } from '../dto/create-orden-compra.dto';
import { ListOrdenesQueryDto } from '../dto/list-ordenes-query.dto';
import { OrdenCompraResponseDto } from '../dto/orden-compra-response.dto';
import type { OrdenCompraResponse } from '../interfaces/orden-compra.interfaces';
import { OrdenCompraService } from '../services/orden-compra.service';

@ApiTags(SWAGGER_TAGS.COMPRAS_OC)
@Controller('compras/ordenes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class OrdenCompraController {
  constructor(private readonly ordenService: OrdenCompraService) {}

  @Post()
  @Roles(...ROLES_OC_ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear orden de compra (desde cero o desde SOL aprobada)',
  })
  @ApiCreatedResponse({ type: OrdenCompraResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Sin permisos o entidades fuera del tenant',
  })
  create(
    @Body() dto: CreateOrdenCompraDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OrdenCompraResponse> {
    return this.ordenService.create(dto, ctx);
  }

  @Get()
  @Roles(...ROLES_OC_LECTURA)
  @ApiOperation({ summary: 'Listar órdenes de compra del tenant' })
  @ApiOkResponse({ type: OrdenCompraResponseDto, isArray: true })
  list(
    @Query() query: ListOrdenesQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OrdenCompraResponse[]> {
    return this.ordenService.list(query, ctx);
  }

  @Get(':id')
  @Roles(...ROLES_OC_LECTURA)
  @ApiOperation({ summary: 'Obtener orden de compra por id' })
  @ApiOkResponse({ type: OrdenCompraResponseDto })
  @ApiNotFoundResponse({ description: 'Orden no encontrada' })
  findById(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OrdenCompraResponse> {
    return this.ordenService.findById(id, ctx);
  }

  @Post(':id/emitir')
  @Roles(...ROLES_OC_ESCRITURA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Emitir orden de compra (borrador → emitida)' })
  @ApiOkResponse({ type: OrdenCompraResponseDto })
  emitir(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OrdenCompraResponse> {
    return this.ordenService.emitir(id, ctx);
  }

  @Post(':id/cancelar')
  @Roles(...ROLES_OC_ESCRITURA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar orden de compra' })
  @ApiOkResponse({ type: OrdenCompraResponseDto })
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<OrdenCompraResponse> {
    return this.ordenService.cancelar(id, ctx);
  }
}
