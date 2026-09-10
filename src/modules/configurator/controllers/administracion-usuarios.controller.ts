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
import { CreateAdministracionUsuarioDto } from '../dto/create-administracion-usuario.dto';
import { CreateUsuarioResponseDto } from '../dto/create-usuario-response.dto';
import { ResetAdministracionUsuarioPasswordDto } from '../dto/reset-administracion-usuario-password.dto';
import { UpdateAdministracionUsuarioDto } from '../dto/update-administracion-usuario.dto';
import type { CreateUsuarioResponse } from '../interfaces/usuarios.interfaces';
import { AdministracionUsuariosService } from '../services/administracion-usuarios.service';

@ApiTags(SWAGGER_TAGS.USUARIOS_ADMIN_CUENTA)
@Controller('administracion/usuarios')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(WmsRol.administrador_cuenta)
@ApiBearerAuth('access-token')
export class AdministracionUsuariosController {
  constructor(
    private readonly usuariosService: AdministracionUsuariosService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear usuario del tenant',
    description:
      'Solo administrador de cuenta (scope cuenta). Crea usuarios de nivel cuenta o bodega en la empresa y cuenta del contexto tenant.',
  })
  @ApiCreatedResponse({ type: CreateUsuarioResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Solo administrador de cuenta puede crear usuarios',
  })
  create(
    @Body() dto: CreateAdministracionUsuarioDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<CreateUsuarioResponse> {
    return this.usuariosService.create(dto, ctx);
  }

  @Patch(':idUsuario')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar usuario del tenant',
    description:
      'Solo administrador de cuenta. Actualiza nombre, correo y/o teléfono. El código (username) no se modifica.',
  })
  @ApiParam({
    name: 'idUsuario',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({ type: CreateUsuarioResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Solo administrador de cuenta puede actualizar usuarios',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  update(
    @Param('idUsuario', ParseUUIDPipe) idUsuario: string,
    @Body() dto: UpdateAdministracionUsuarioDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<CreateUsuarioResponse> {
    return this.usuariosService.update(idUsuario, dto, ctx);
  }

  @Post(':idUsuario/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restablecer contraseña de un usuario del tenant',
    description:
      'Solo administrador de cuenta. Define una nueva contraseña para el usuario indicado.',
  })
  @ApiParam({
    name: 'idUsuario',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({ type: CreateUsuarioResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({
    description: 'Solo administrador de cuenta puede restablecer contraseñas',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  resetPassword(
    @Param('idUsuario', ParseUUIDPipe) idUsuario: string,
    @Body() dto: ResetAdministracionUsuarioPasswordDto,
    @TenantCtx() ctx: TenantContext,
  ): Promise<CreateUsuarioResponse> {
    return this.usuariosService.resetPassword(idUsuario, dto.password, ctx);
  }
}
