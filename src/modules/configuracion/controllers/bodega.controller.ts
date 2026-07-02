import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { CreateBodegaDto } from '../dto/create-bodega.dto';
import { CreateBodegaResponseDto } from '../dto/create-bodega-response.dto';
import type { CreateBodegaResult } from '../interfaces/bodega.interfaces';
import { BodegaService } from '../services/bodega.service';

@ApiTags(SWAGGER_TAGS.CONFIGURACION_BODEGAS)
@Controller('configuracion/bodegas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(WmsRol.configurador)
@ApiBearerAuth('access-token')
export class BodegaController {
  constructor(private readonly bodegaService: BodegaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear bodega interna o externa',
    description:
      'Persiste la bodega vía backend (bypass RLS). Solo configurador. ' +
      'Para bodegas internas, llamar después POST /configuracion/bodegas/:idBodega/bootstrap-layout.',
  })
  @ApiCreatedResponse({ type: CreateBodegaResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Rol no autorizado o cuenta fuera del tenant',
  })
  @ApiNotFoundResponse({ description: 'Cuenta no encontrada' })
  @ApiConflictResponse({
    description: 'Ya existe una bodega con ese código en la cuenta',
  })
  create(
    @Body() dto: CreateBodegaDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<CreateBodegaResult> {
    return this.bodegaService.create(dto, ctx);
  }
}
