import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { TenantCtx } from '../../../core/decorators/tenant-context.decorator';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { Roles } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { WmsRol } from '../../../generated/prisma/client';
import {
  PropuestaReagrupacionBodyDto,
  PropuestaReagrupacionResponseDto,
} from '../dto/propuesta-reagrupacion.dto';
import { OrdenTrabajoReagrupacionService } from '../services/orden-trabajo-reagrupacion.service';

/** Solo quien opera pedidos de la cuenta puede pedir la reagrupación (R1). */
export const ROLES_REAGRUPACION_OT = [
  WmsRol.administrador_cuenta,
  WmsRol.operador_cuenta,
] as const;

@ApiTags(SWAGGER_TAGS.VENTAS_OV)
@Controller('ventas/ordenes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class OrdenTrabajoReagrupacionController {
  constructor(private readonly service: OrdenTrabajoReagrupacionService) {}

  @Post(':id/ordenes-trabajo/propuesta-reagrupacion')
  @Roles(...ROLES_REAGRUPACION_OT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Proponer una nueva distribución de las OT de una OV (IA)',
    description:
      'Solo para OV en `por_confirmar`. Devuelve una PROPUESTA validada; no escribe nada en la base de datos. ' +
      'La cuenta se deriva del JWT: el body no lleva `codigoCuenta`.',
  })
  @ApiOkResponse({ type: PropuestaReagrupacionResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({
    description:
      'La OV no existe o no pertenece a la cuenta (misma respuesta).',
  })
  @ApiConflictResponse({
    description: 'La OV ya no está por confirmar (`OV_ESTADO_CAMBIO`).',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'La IA no devolvió una propuesta válida (`PROPUESTA_INVALIDA`).',
  })
  @ApiBadGatewayResponse({
    description: 'Falló la consulta al proveedor de IA (`PROVEEDOR_IA`).',
  })
  proponer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PropuestaReagrupacionBodyDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<PropuestaReagrupacionResponseDto> {
    return this.service.proponer(id, body, ctx);
  }
}
