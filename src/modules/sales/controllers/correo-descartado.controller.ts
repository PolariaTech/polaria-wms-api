import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  StreamableFile,
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
import {
  CorreoContenidoResponseDto,
  CorreosListaResponseDto,
} from '../dto/correos-response.dto';
import { IngresoCorreoResponseDto } from '../dto/ingreso-correo-response.dto';
import { CorreoDescartadoService } from '../services/correo-descartado.service';
import { ROLES_REAGRUPACION_OT } from './orden-trabajo-reagrupacion.controller';

const MIME_SEGURO = /^[\w.+-]+\/[\w.+-]+$/;

/**
 * `Content-Disposition` de un adjunto: siempre `attachment` (nunca se muestra dentro del
 * dominio del api, donde un .html ejecutaría scripts) y con el nombre protegido contra
 * saltos de línea y comillas.
 */
export function disposicionDeAdjunto(nombre: string): string {
  const limpio = nombre.replace(/[\r\n"\\]/g, '').trim() || 'adjunto';
  const ascii = limpio.replace(/[^\x20-\x7E]/g, '_');
  const codificado = encodeURIComponent(limpio).replace(
    /['()*]/g,
    (simbolo) => `%${simbolo.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${codificado}`;
}

@ApiTags(SWAGGER_TAGS.VENTAS_OV)
@Controller('ventas/correos')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class CorreoDescartadoController {
  constructor(private readonly service: CorreoDescartadoService) {}

  /**
   * Lecturas guiadas por la persona (filtrar, abrir un correo, bajar adjuntos): llevan su
   * propio límite y saltan solo el `auth` global (15 por minuto para toda la empresa), que
   * las cortaría con un uso normal.
   */
  @Get()
  @Roles(...ROLES_REAGRUPACION_OT)
  @SkipThrottle({ auth: true })
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

  @Get(':messageId/contenido')
  @Roles(...ROLES_REAGRUPACION_OT)
  @SkipThrottle({ auth: true })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Ver el correo completo (cuerpo y datos de los adjuntos)',
    description:
      'Lee el correo en Gmail (vía n8n) y devuelve el cuerpo en texto y en HTML, más nombre, tipo y tamaño de cada adjunto. Los archivos se bajan con `GET …/adjuntos/:indice`. El HTML llega tal cual: quien lo muestre debe aislarlo. El correo se guarda unos minutos en memoria.',
  })
  @ApiOkResponse({ type: CorreoContenidoResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiBadGatewayResponse({
    description:
      'n8n o Gmail no respondieron (`N8N_NO_RESPONDE`, `N8N_ERROR`).',
  })
  contenido(
    @Param('messageId') messageId: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<CorreoContenidoResponseDto> {
    return this.service.contenido(messageId, ctx);
  }

  @Get(':messageId/adjuntos/:indice')
  @Roles(...ROLES_REAGRUPACION_OT)
  @SkipThrottle({ auth: true })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Descargar un adjunto del correo',
    description:
      'Devuelve el archivo con `Content-Disposition: attachment`. `indice` es la posición que trae `contenido().adjuntos`.',
  })
  @ApiOkResponse({ description: 'El archivo.' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({
    description: 'No hay adjunto en esa posición (`ADJUNTO_NO_ENCONTRADO`).',
  })
  async adjunto(
    @Param('messageId') messageId: string,
    @Param('indice', ParseIntPipe) indice: number,
    @TenantCtx() ctx: TenantContext,
  ): Promise<StreamableFile> {
    const { nombre, mimeType, buffer } = await this.service.adjunto(
      messageId,
      indice,
      ctx,
    );
    return new StreamableFile(buffer, {
      type: MIME_SEGURO.test(mimeType) ? mimeType : 'application/octet-stream',
      disposition: disposicionDeAdjunto(nombre),
      length: buffer.length,
    });
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
