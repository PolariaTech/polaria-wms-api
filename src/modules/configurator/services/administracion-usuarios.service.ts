import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WmsRol } from '../../../generated/prisma/client';
import {
  ROLES_NIVEL_BODEGA,
  ROLES_NIVEL_CUENTA,
} from '../../../shared/constants/roles';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { CreateAdministracionUsuarioDto } from '../dto/create-administracion-usuario.dto';
import { ConfiguradorUsuarioRepository } from '../infrastructure/configurador-usuario.repository';
import type {
  CreateUsuarioResponse,
  UpdateUsuarioInput,
} from '../interfaces/usuarios.interfaces';
import { ConfiguradorUsuariosService } from './configurador-usuarios.service';

const ROLES_PERMITIDOS_ADMINISTRACION = [
  ...ROLES_NIVEL_CUENTA,
  ...ROLES_NIVEL_BODEGA,
] as readonly WmsRol[];

@Injectable()
export class AdministracionUsuariosService {
  constructor(
    private readonly configuradorUsuariosService: ConfiguradorUsuariosService,
    private readonly usuarioRepository: ConfiguradorUsuarioRepository,
  ) {}

  async create(
    dto: CreateAdministracionUsuarioDto,
    ctx: TenantContext,
  ): Promise<CreateUsuarioResponse> {
    if (!ctx.codigoEmpresa || !ctx.codigoCuenta) {
      throw new ForbiddenException(
        'El contexto tenant debe incluir empresa y cuenta activas',
      );
    }

    const idRol = dto.idRol ?? WmsRol.operador_cuenta;

    if (idRol === WmsRol.configurador) {
      throw new BadRequestException(
        'No se puede crear un usuario configurador desde este endpoint',
      );
    }

    if (!ROLES_PERMITIDOS_ADMINISTRACION.includes(idRol)) {
      throw new BadRequestException(
        'Rol no permitido para administración de cuenta',
      );
    }

    return this.configuradorUsuariosService.create(
      {
        username: dto.username,
        nombre: dto.nombre,
        idRol,
        codigoEmpresa: ctx.codigoEmpresa,
        codigoCuenta: ctx.codigoCuenta,
        idBodega: dto.idBodega,
        correo: dto.correo,
        telefono: dto.telefono,
        password: dto.password,
      },
      ctx.idUsuario,
    );
  }

  async update(
    idUsuario: string,
    dto: UpdateUsuarioInput,
    ctx: TenantContext,
  ): Promise<CreateUsuarioResponse> {
    this.assertTenantContext(ctx);
    await this.assertUsuarioAdministrable(idUsuario, ctx);
    return this.configuradorUsuariosService.update(idUsuario, dto);
  }

  async resetPassword(
    idUsuario: string,
    password: string,
    ctx: TenantContext,
  ): Promise<CreateUsuarioResponse> {
    this.assertTenantContext(ctx);
    await this.assertUsuarioAdministrable(idUsuario, ctx);
    return this.configuradorUsuariosService.resetPassword(idUsuario, password);
  }

  private assertTenantContext(ctx: TenantContext): void {
    if (!ctx.codigoEmpresa || !ctx.codigoCuenta) {
      throw new ForbiddenException(
        'El contexto tenant debe incluir empresa y cuenta activas',
      );
    }
  }

  private async assertUsuarioAdministrable(
    idUsuario: string,
    ctx: TenantContext,
  ): Promise<void> {
    const usuario = await this.usuarioRepository.findById(idUsuario);
    if (
      !usuario ||
      !usuario.estaActivo ||
      usuario.codigoCuenta !== ctx.codigoCuenta
    ) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (usuario.idRol === WmsRol.configurador) {
      throw new ForbiddenException(
        'No se puede administrar un usuario configurador desde este endpoint',
      );
    }

    if (!ROLES_PERMITIDOS_ADMINISTRACION.includes(usuario.idRol)) {
      throw new ForbiddenException(
        'No puedes administrar este usuario desde este endpoint',
      );
    }
  }
}
