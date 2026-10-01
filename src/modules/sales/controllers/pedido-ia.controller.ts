import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { TenantCtx } from '../../../core/decorators/tenant-context.decorator';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { Roles } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { ROLES_OV_ESCRITURA } from '../constants/orden-venta.constants';
import {
  ArchivoExtraidoResponseDto,
  PedidoExtraidoResponseDto,
} from '../dto/pedido-ia-response.dto';
import { PedidoIaService } from '../services/pedido-ia.service';
import { LeerPedidoBodyDto } from '../dto/leer-pedido-body.dto';

@ApiTags(SWAGGER_TAGS.VENTAS_OV)
@Controller('ventas')
export class PedidoIaController {
  constructor(
    private readonly pedidoIaService: PedidoIaService,
    private readonly config: ConfigService,
  ) {}

  @Post('leer-pedido')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(...ROLES_OV_ESCRITURA)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('archivos', 8))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Leer pedido con IA (texto y/o archivos)',
    description:
      'Extrae PDF/Excel/Word/HTML/.eml/fotos, llama a OpenAI y devuelve el pedido estructurado ' +
      'para prellenar el formulario de OV. Mismo contrato que el BFF Next anterior.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['codigoCuenta'],
      properties: {
        codigoCuenta: { type: 'string', example: '49M04' },
        cliente: { type: 'string', example: 'Hotel Seadust' },
        texto: {
          type: 'string',
          description: 'Mensaje pegado (opcional si hay archivos)',
        },
        archivos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Hasta 8 archivos ≤ 15MB c/u',
        },
      },
    },
  })
  @ApiOkResponse({ type: PedidoExtraidoResponseDto })
  @ApiUnauthorizedResponse()
  leerPedido(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() body: LeerPedidoBodyDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<PedidoExtraidoResponseDto> {
    return this.pedidoIaService.leerPedido({
      codigoCuenta: body.codigoCuenta ?? '',
      cliente: body.cliente,
      texto: body.texto ?? '',
      files: files ?? [],
      ctx,
    });
  }

  @Post('ai/extraer-archivos')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('archivos', 8))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Extraer contenido de archivos (PDF, Excel, .eml, imagen…)',
    description:
      'Parsers sin OpenAI. Server-to-server (captura QR) con header X-Internal-Api-Key.',
  })
  @ApiHeader({
    name: 'X-Internal-Api-Key',
    required: true,
    description:
      'Clave server-to-server (misma env INTERNAL_API_KEY en web y Nest).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        archivos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOkResponse({ type: ArchivoExtraidoResponseDto, isArray: true })
  async extraerArchivos(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Headers('x-internal-api-key') internalKey?: string,
  ): Promise<ArchivoExtraidoResponseDto[]> {
    const expected = this.config.get<string>('INTERNAL_API_KEY')?.trim();
    if (!expected || internalKey?.trim() !== expected) {
      throw new UnauthorizedException(
        'X-Internal-Api-Key inválida o ausente.',
      );
    }
    return this.pedidoIaService.extraerArchivos(files ?? []);
  }
}
