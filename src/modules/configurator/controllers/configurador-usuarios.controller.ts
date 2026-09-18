import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WmsRol } from '../../../generated/prisma/client';
import { TenantCtx } from '../../../core/decorators/tenant-context.decorator';
import { SWAGGER_TAGS } from '../../../core/swagger/swagger.constants';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { Roles } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { CreateUsuarioResponseDto } from '../dto/create-usuario-response.dto';
import { CreateUsuarioDto } from '../dto/create-usuario.dto';
import { UpdateConfiguradorUsuarioDto } from '../dto/update-configurador-usuario.dto';
import type { CreateUsuarioResponse } from '../interfaces/usuarios.interfaces';
import { ConfiguradorUsuariosService } from '../services/configurador-usuarios.service';

@ApiTags(SWAGGER_TAGS.USUARIOS_CONFIGURADOR)
@Controller('configurador/usuarios')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(WmsRol.configurador)
@ApiBearerAuth('access-token')
export class ConfiguradorUsuariosController {
  constructor(private readonly usuariosService: ConfiguradorUsuariosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear usuario del tenant',
    description:
      'Solo rol configurador (scope platform). Crea credenciales en Supabase Auth y fila en tabla usuario.',
  })
  @ApiCreatedResponse({ type: CreateUsuarioResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Solo configurador puede crear usuarios',
  })
  create(
    @Body() dto: CreateUsuarioDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<CreateUsuarioResponse> {
    return this.usuariosService.create(dto, ctx.idUsuario);
  }

  @Patch(':idUsuario')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar usuario',
    description:
      'Solo configurador. Actualiza nombre, correo, teléfono, inicio de sesión y productos (WMS / Mateo IA).',
  })
  @ApiParam({
    name: 'idUsuario',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({ type: CreateUsuarioResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Solo configurador puede actualizar usuarios',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  update(
    @Param('idUsuario', ParseUUIDPipe) idUsuario: string,
    @Body() dto: UpdateConfiguradorUsuarioDto,
  ): Promise<CreateUsuarioResponse> {
    return this.usuariosService.update(idUsuario, dto);
  }
}
