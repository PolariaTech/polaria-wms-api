import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { ROLES_REGISTRAR_ENTREGA } from '../constants/transport.constants';
import { RegistrarEntregaDto } from '../dto/registrar-entrega.dto';
import { RegistrarEntregaResponseDto } from '../dto/registrar-entrega-response.dto';
import type { RegistrarEntregaResponse } from '../interfaces/entrega.interfaces';
import { RegistrarEntregaService } from '../services/registrar-entrega.service';

@ApiTags(SWAGGER_TAGS.TRANSPORTE)
@Controller('transporte')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class RegistrarEntregaController {
  constructor(private readonly service: RegistrarEntregaService) {}

  @Post('entregas')
  @Roles(...ROLES_REGISTRAR_ENTREGA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar entrega de un viaje (foto, firma, conformidad)',
    description:
      'Cierra viaje + guía, crea evidencias, cierra la OV y libera el camión si no tiene más viajes activos (flujo frio).',
  })
  @ApiOkResponse({ type: RegistrarEntregaResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  registrar(
    @Body() dto: RegistrarEntregaDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<RegistrarEntregaResponse> {
    return this.service.registrar(dto, ctx);
  }
}
