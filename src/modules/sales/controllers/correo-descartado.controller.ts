import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiAcceptedResponse,
  ApiBadGatewayResponse,
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
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { Roles } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { CorreosQueryDto } from '../dto/correos-query.dto';
import { CorreosListaResponseDto } from '../dto/correos-response.dto';
import { IngresoCorreoResponseDto } from '../dto/ingreso-correo-response.dto';
import { CorreoDescartadoService } from '../services/correo-descartado.service';
import { ROLES_REAGRUPACION_OT } from './orden-trabajo-reagrupacion.controller';

@ApiTags(SWAGGER_TAGS.VENTAS_OV)
@Controller('ventas/correos')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class CorreoDescartadoController {
  constructor(private readonly service: CorreoDescartadoService) {}

  @Get()
  @Roles(...ROLES_REAGRUPACION_OT)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Listar los correos de pedidos que registró n8n (REQ-104)',
    description:
      'Pagina y filtra en n8n (nunca baja toda la tabla). `modo=descartados` trae solo los que el workflow no ingresó. Cada fila trae `ingreso` si el WMS ya la tiene como OV o la está procesando. Solo para las cuentas de `N8N_CORREOS_CUENTAS`.',
  })
  @ApiOkResponse({ type: CorreosListaResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({
    description:
      'La cuenta no tiene habilitados los correos (`CORREOS_NO_DISPONIBLES`).',
  })
  @ApiBadGatewayResponse({
    description: 'n8n no respondió (`N8N_NO_RESPONDE`, `N8N_ERROR`).',
  })
  listar(
    @Query() query: CorreosQueryDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<CorreosListaResponseDto> {
    return this.service.listar(query, ctx);
  }

  /**
   * Leer el correo con IA tarda más que los 30 s del proxy de Next: responde 202 y termina
   * en segundo plano. Un límite bajo evita encadenar lecturas caras.
   */
  @Post(':messageId/ingresar')
  @Roles(...ROLES_REAGRUPACION_OT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Ingresar un correo como OV (manual)',
    description:
      'Reserva el correo, responde 202 y crea la OV `por_confirmar` en segundo plano con el mismo núcleo que `ingestar-pedido`. Se consulta con `GET …/:messageId/ingreso`. Varios clics no duplican la OV: el segundo devuelve el estado actual, o 409 si ya está ingresado.',
  })
  @ApiAcceptedResponse({ type: IngresoCorreoResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse({
    description:
      'Ya se ingresó como OV (`CORREO_YA_INGRESADO`; el código de la OV va en el mensaje y en `GET …/ingreso`).',
  })
  ingresar(
    @Param('messageId') messageId: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<IngresoCorreoResponseDto> {
    return this.service.ingresar(messageId, ctx);
  }

  /**
   * Se consulta cada pocos segundos mientras corre. Salta los dos límites globales
   * (`default` y `auth`): con solo el primero, `auth` (15 por minuto) cortaba el sondeo.
   */
  @Get(':messageId/ingreso')
  @Roles(...ROLES_REAGRUPACION_OT)
  @SkipThrottle({ default: true, auth: true })
  @ApiOperation({ summary: 'Consultar el avance del ingreso de un correo' })
  @ApiOkResponse({ type: IngresoCorreoResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({
    description:
      'Ese correo todavía no se ha intentado ingresar (`INGRESO_NO_ENCONTRADO`).',
  })
  consultar(
    @Param('messageId') messageId: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<IngresoCorreoResponseDto> {
    return this.service.consultar(messageId, ctx);
  }
}
