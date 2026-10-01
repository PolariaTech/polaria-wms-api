import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import {
  ArchivoExtraidoResponseDto,
  PedidoExtraidoResponseDto,
} from '../dto/pedido-ia-response.dto';
import { PedidoIaService } from '../services/pedido-ia.service';
import { LeerPedidoBodyDto } from '../dto/leer-pedido-body.dto';
import { PedidoIaApiKeyGuard } from '../guards/pedido-ia-api-key.guard';

@ApiTags(SWAGGER_TAGS.VENTAS_OV)
@Controller('ventas')
@UseGuards(PedidoIaApiKeyGuard)
@ApiSecurity('pedido-ia-api-key')
export class PedidoIaController {
  constructor(private readonly pedidoIaService: PedidoIaService) {}

  @Post('leer-pedido')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('archivos', 8))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Leer pedido con IA (texto y/o archivos) — API pública de integración',
    description:
      'Sin login de usuario. Autenticación por API key (X-Api-Key). ' +
      'Extrae PDF/Excel/Word/HTML/.eml/fotos, usa OpenAI del servidor y devuelve el pedido estructurado. ' +
      'Requiere codigoCuenta para resolver el catálogo del tenant.',
  })
  @ApiHeader({
    name: 'X-Api-Key',
    required: true,
    description: 'Clave de integración (env PEDIDO_IA_API_KEY).',
  })
  @ApiHeader({
    name: 'X-Internal-Api-Key',
    required: false,
    description:
      'Alternativa (env INTERNAL_API_KEY). Usa una de las dos keys.',
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
  ): Promise<PedidoExtraidoResponseDto> {
    return this.pedidoIaService.leerPedido({
      codigoCuenta: body.codigoCuenta ?? '',
      cliente: body.cliente,
      texto: body.texto ?? '',
      files: files ?? [],
    });
  }

  @Post('ai/extraer-archivos')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('archivos', 8))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Extraer contenido de archivos — API pública de integración',
    description:
      'Sin login. Parsers (PDF, Excel, .eml, imagen…) sin OpenAI. Auth por X-Api-Key.',
  })
  @ApiHeader({
    name: 'X-Api-Key',
    required: true,
    description: 'Clave de integración (env PEDIDO_IA_API_KEY).',
  })
  @ApiHeader({
    name: 'X-Internal-Api-Key',
    required: false,
    description: 'Alternativa (env INTERNAL_API_KEY).',
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
  extraerArchivos(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<ArchivoExtraidoResponseDto[]> {
    return this.pedidoIaService.extraerArchivos(files ?? []);
  }
}
