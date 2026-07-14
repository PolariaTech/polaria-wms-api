import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
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
}
