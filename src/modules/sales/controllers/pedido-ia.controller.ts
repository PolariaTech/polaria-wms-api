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
  ApiCreatedResponse,
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
import { IngestarPedidoBodyDto } from '../dto/ingestar-pedido-body.dto';
import { IngestarPedidoResponseDto } from '../dto/ingestar-pedido-response.dto';
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
      'Requiere codigoCuenta para resolver el catálogo del tenant. ' +
      'origenCorreo incluye entrega (ventana, dirección, teléfono, notas). ' +
      'Opcional: numeroCorreo / horario para sellar metadatos del mensaje.',
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
        numeroCorreo: {
          type: 'string',
          description: 'Id del mensaje (Gmail/hash) → origenCorreo[].Numero correo',
        },
        horario: {
          type: 'string',
          description: 'Timestamp ingestión → origenCorreo[].Horario',
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
      numeroCorreo: body.numeroCorreo,
      horario: body.horario,
      files: files ?? [],
    });
  }

  @Post('ingestar-pedido')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('archivos', 8))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Ingestar pedido: IA + crear OV por_confirmar',
    description:
      'Para el bot/n8n de correo. Extrae con OpenAI y crea la OV con ' +
      'origen_correo (entrega incluida), origen_texto y cabecera. ' +
      'idBodega es opcional (usa bodega default de la cuenta). ' +
      'No armar el JSON a mano ni dejar Ventana/Direccion/Tel vacíos.',
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
      required: ['codigoCuenta'],
      properties: {
        codigoCuenta: { type: 'string', example: '49M04' },
        idBodega: {
          type: 'string',
          format: 'uuid',
          description: 'Opcional. Si falta: bodega default de la cuenta.',
        },
        cliente: { type: 'string' },
        texto: { type: 'string' },
        numeroCorreo: { type: 'string' },
        horario: { type: 'string' },
        origenArchivos: { type: 'string' },
        archivos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiCreatedResponse({ type: IngestarPedidoResponseDto })
  @ApiUnauthorizedResponse()
  ingestarPedido(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() body: IngestarPedidoBodyDto,
  ): Promise<IngestarPedidoResponseDto> {
    return this.pedidoIaService.ingestarPedido({
      codigoCuenta: body.codigoCuenta ?? '',
      idBodega: body.idBodega,
      cliente: body.cliente,
      texto: body.texto ?? '',
      numeroCorreo: body.numeroCorreo,
      horario: body.horario,
      origenArchivos: body.origenArchivos,
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
