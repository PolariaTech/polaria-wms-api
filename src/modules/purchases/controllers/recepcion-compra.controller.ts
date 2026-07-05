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
import { SensitiveWriteGuard } from '../../../core/guards/sensitive-write.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import {
  ROLES_RECEPCION_ESCRITURA,
  ROLES_RECEPCION_LECTURA,
} from '../constants/recepcion-compra.constants';
import { CreateRecepcionCompraDto } from '../dto/create-recepcion-compra.dto';
import { ListRecepcionesQueryDto } from '../dto/list-recepciones-query.dto';
import { RecepcionCompraResponseDto } from '../dto/recepcion-compra-response.dto';
import type { RecepcionCompraResponse } from '../interfaces/recepcion-compra.interfaces';
import { RecepcionCompraService } from '../services/recepcion-compra.service';

@ApiTags(SWAGGER_TAGS.COMPRAS_RECEPCION)
@Controller('compras/recepciones')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class RecepcionCompraController {
  constructor(private readonly recepcionService: RecepcionCompraService) {}

  @Post('ordenes/:idOrdenCompra/cerrar')
  @Roles(...ROLES_RECEPCION_ESCRITURA)
  @UseGuards(SensitiveWriteGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cerrar recepción contra OC (conciliación ciega + temperatura)',
    description:
      'Persiste recepción vía backend (bypass RLS). Actualiza cantidades recibidas y estado de la OC. ' +
      'Opcionalmente registra inventario en slot de zona ingreso (`idUbicacionIngreso`).',
  })
  @ApiCreatedResponse({ type: RecepcionCompraResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'Rol no autorizado o fuera del tenant' })
  cerrar(
    @Param('idOrdenCompra', ParseUUIDPipe) idOrdenCompra: string,
    @Body() dto: CreateRecepcionCompraDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<RecepcionCompraResponse> {
    return this.recepcionService.cerrar(idOrdenCompra, dto, ctx);
  }

  @Get()
  @Roles(...ROLES_RECEPCION_LECTURA)
  @ApiOperation({ summary: 'Listar recepciones del tenant' })
  @ApiOkResponse({ type: RecepcionCompraResponseDto, isArray: true })
  list(
    @Query() query: ListRecepcionesQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<RecepcionCompraResponse[]> {
    return this.recepcionService.list(query, ctx);
  }

  @Get('ordenes/:idOrdenCompra')
  @Roles(...ROLES_RECEPCION_LECTURA)
  @ApiOperation({ summary: 'Obtener recepción por orden de compra' })
  @ApiOkResponse({ type: RecepcionCompraResponseDto })
  @ApiNotFoundResponse({ description: 'Recepción no encontrada' })
  findByOrden(
    @Param('idOrdenCompra', ParseUUIDPipe) idOrdenCompra: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<RecepcionCompraResponse> {
    return this.recepcionService.findByOrden(idOrdenCompra, ctx);
  }

  @Get(':id')
  @Roles(...ROLES_RECEPCION_LECTURA)
  @ApiOperation({ summary: 'Obtener recepción por id' })
  @ApiOkResponse({ type: RecepcionCompraResponseDto })
  @ApiNotFoundResponse({ description: 'Recepción no encontrada' })
  findById(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<RecepcionCompraResponse> {
    return this.recepcionService.findById(id, ctx);
  }
}
