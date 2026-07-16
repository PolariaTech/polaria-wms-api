import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TenantCtx } from '../../../core/decorators/tenant-context.decorator';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { Roles } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { ROLES_PAQUETE_DESPACHO } from '../constants/transport.constants';
import { CrearPaqueteDespachoDto } from '../dto/crear-paquete-despacho.dto';
import { PaqueteDespachoResponseDto } from '../dto/paquete-despacho-response.dto';
import type { PaqueteDespachoResponse } from '../interfaces/transport.interfaces';
import { PaqueteDespachoService } from '../services/paquete-despacho.service';

@ApiTags(SWAGGER_TAGS.TRANSPORTE)
@Controller('transporte')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class PaqueteDespachoController {
  constructor(private readonly service: PaqueteDespachoService) {}

  @Post('paquetes-despacho')
  @Roles(...ROLES_PAQUETE_DESPACHO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Armar paquete de despacho y enviar a transporte',
    description:
      'Crea un viaje + guía por cada OV, marca el camión como no disponible, ' +
      'actualiza la OV a despachada y consume stock de zona de salida (flujo frio / custodio).',
  })
  @ApiOkResponse({ type: PaqueteDespachoResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  crear(
    @Body() dto: CrearPaqueteDespachoDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<PaqueteDespachoResponse> {
    return this.service.crear(dto, ctx);
  }
}
