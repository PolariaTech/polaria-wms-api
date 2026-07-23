import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { WmsRol } from '../../../generated/prisma/client';
import {
  ROLES_NIVEL_BODEGA,
  ROLES_NIVEL_CUENTA,
} from '../../../shared/constants/roles';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { CreateAdministracionUsuarioDto } from '../dto/create-administracion-usuario.dto';
import type { CreateUsuarioResponse } from '../interfaces/usuarios.interfaces';
import { ConfiguradorUsuariosService } from './configurador-usuarios.service';

const ROLES_PERMITIDOS_ADMINISTRACION = [
  ...ROLES_NIVEL_CUENTA,
  ...ROLES_NIVEL_BODEGA,
] as readonly WmsRol[];

@Injectable()
export class AdministracionUsuariosService {
  constructor(
    private readonly configuradorUsuariosService: ConfiguradorUsuariosService,
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
}
