import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { TenantCtx } from '../../../core/decorators/tenant-context.decorator';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { Roles } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import {
  CorreccionConsultaResponseDto,
  CorreccionIniciadaResponseDto,
  InterpretacionInstruccionResponseDto,
  InterpretarInstruccionBodyDto,
  PropuestaCorreccionCorreoBodyDto,
} from '../dto/propuesta-correccion-correo.dto';
import { OrdenCorreoRelecturaService } from '../services/orden-correo-relectura.service';
import { ROLES_REAGRUPACION_OT } from './orden-trabajo-reagrupacion.controller';

@ApiTags(SWAGGER_TAGS.VENTAS_OV)
@Controller('ventas/ordenes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class OrdenCorreoRelecturaController {
  constructor(private readonly service: OrdenCorreoRelecturaService) {}

  /** Una sola llamada barata (un modelo, sin archivos): decide la función del botón «Generar». */
  @Post(':id/ordenes-trabajo/interpretar-instruccion')
  @Roles(...ROLES_REAGRUPACION_OT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Interpretar la instrucción del chat de OT: reorganizar renglones o releer el correo y los archivos',
    description:
      'Solo para OV en `por_confirmar`. Devuelve qué función corresponde (`reorganizar` o `releer_documentos`) y lo que el usuario dijo esperar (cuántas OT, qué total). No escribe nada. Si el modelo falla responde con un respaldo por reglas (`porReglas: true`).',
  })
  @ApiOkResponse({ type: InterpretacionInstruccionResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({
    description: 'La OV no existe o no pertenece a la cuenta (misma respuesta).',
  })
  @ApiConflictResponse({
    description: 'La OV ya no está por confirmar (`OV_ESTADO_CAMBIO`).',
  })
  interpretar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: InterpretarInstruccionBodyDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<InterpretacionInstruccionResponseDto> {
    return this.service.interpretar(id, body, ctx);
  }

  /**
   * Cada corrida relee los archivos originales con IA (decenas de miles de tokens y
   * hasta minutos): responde 202 al instante y la corrección corre en segundo plano.
   * Un límite bajo por usuario evita encadenar llamadas caras (REQ-187).
   */
  @Post(':id/ordenes-trabajo/propuesta-correccion-correo')
  @Roles(...ROLES_REAGRUPACION_OT)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Iniciar la corrección de las OT de una OV releyendo sus archivos originales (correo y PDF) con IA',
    description:
      'Solo para OV en `por_confirmar`. Valida lo barato al instante (OV, cuenta, estado, archivos) y arranca la relectura en segundo plano: responde 202 con un `jobId` que se consulta con `GET …/propuesta-correccion-correo/:jobId`. ' +
      'Relee cada PDF por separado, verifica la suma contra el «Total pedido» de cada documento y arma una PROPUESTA con diff; no escribe nada en la base de datos. ' +
      'La cuenta se deriva del JWT y los archivos salen de la propia OV: el body no lleva `codigoCuenta` ni rutas.',
  })
  @ApiAcceptedResponse({ type: CorreccionIniciadaResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({
    description: 'La OV no existe o no pertenece a la cuenta (misma respuesta).',
  })
  @ApiConflictResponse({
    description: 'La OV ya no está por confirmar (`OV_ESTADO_CAMBIO`).',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Sin archivos originales (`SIN_ADJUNTOS_ORIGINALES`).',
  })
  iniciar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PropuestaCorreccionCorreoBodyDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<CorreccionIniciadaResponseDto> {
    return this.service.iniciar(id, body, ctx);
  }

  /**
   * Se consulta cada pocos segundos mientras corre: no cuenta contra el límite del POST.
   * Salta los dos límites globales (`default` y `auth`): con solo el primero, el de
   * `auth` (15 por minuto) cortaba el sondeo de 3 s a mitad de la relectura.
   */
  @Get(':id/ordenes-trabajo/propuesta-correccion-correo/:jobId')
  @Roles(...ROLES_REAGRUPACION_OT)
  @SkipThrottle({ default: true, auth: true })
  @ApiOperation({
    summary: 'Consultar el avance de una corrección iniciada',
    description:
      'Devuelve `procesando` o `listo` con la propuesta. Si la corrección falló responde el mismo error que tendría la llamada directa (409 `OC_REPETIDA`, 422 `RELECTURA_NO_CUADRA`, 502 `PROVEEDOR_IA`…), una sola vez. Solo la ve quien la inició.',
  })
  @ApiOkResponse({ type: CorreccionConsultaResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({
    description:
      'El trabajo no existe, expiró, es de otro usuario u OV, o el servidor se reinició (`TRABAJO_NO_ENCONTRADO`).',
  })
  @ApiConflictResponse({
    description: 'Dos archivos traen la misma OC (`OC_REPETIDA`).',
  })
  @ApiUnprocessableEntityResponse({
    description: 'La relectura no cuadra con el total del documento (`RELECTURA_NO_CUADRA`).',
  })
  @ApiBadGatewayResponse({
    description: 'Falló la consulta al proveedor de IA (`PROVEEDOR_IA`).',
  })
  consultar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @TenantCtx() ctx: TenantContext,
  ): CorreccionConsultaResponseDto {
    return this.service.consultar(id, jobId, ctx);
  }
}
