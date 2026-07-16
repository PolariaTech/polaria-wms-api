import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import { TenantCtx } from '../../../core/decorators/tenant-context.decorator';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import {
  AppendMensajeDto,
  CreateConversacionDto,
} from '../dto/conversaciones.dto';
import {
  MateoConversacionDetalleDto,
  MateoConversacionListItemDto,
  MateoMensajeResponseDto,
} from '../dto/conversaciones-response.dto';
import { ConversacionesService } from '../services/conversaciones.service';

@ApiTags(SWAGGER_TAGS.MATEO_WIDGET)
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('mateo/conversaciones')
export class ConversacionesController {
  constructor(private readonly conversacionesService: ConversacionesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar conversaciones del usuario autenticado' })
  @ApiOkResponse({ type: [MateoConversacionListItemDto] })
  @ApiUnauthorizedResponse()
  list(@TenantCtx() ctx: TenantContext) {
    return this.conversacionesService.list(ctx);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de conversación con mensajes' })
  @ApiOkResponse({ type: MateoConversacionDetalleDto })
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  getDetalle(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ) {
    return this.conversacionesService.getDetalle(id, ctx);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear conversación vacía' })
  @ApiCreatedResponse({ type: MateoConversacionDetalleDto })
  @ApiUnauthorizedResponse()
  create(
    @Body() dto: CreateConversacionDto,
    @TenantCtx() ctx: TenantContext,
  ) {
    return this.conversacionesService.create(dto, ctx);
  }

  @Post(':id/mensajes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Agregar mensaje (user o ai) a la conversación' })
  @ApiCreatedResponse({ type: MateoMensajeResponseDto })
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  appendMensaje(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppendMensajeDto,
    @TenantCtx() ctx: TenantContext,
  ) {
    return this.conversacionesService.appendMensaje(id, dto, ctx);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar conversación del usuario' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantCtx() ctx: TenantContext,
  ): Promise<void> {
    await this.conversacionesService.remove(id, ctx);
  }
}
