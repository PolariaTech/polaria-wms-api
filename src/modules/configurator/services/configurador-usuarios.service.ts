import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import { SupabaseAuthService } from '../../../core/auth/supabase-auth.service';
import {
  ROLES_NIVEL_BODEGA,
  ROLES_NIVEL_CUENTA,
} from '../../../shared/constants/roles';
import { CreateUsuarioDto } from '../dto/create-usuario.dto';
import { ConfiguradorUsuarioRepository } from '../infrastructure/configurador-usuario.repository';
import type { CreateUsuarioResponse } from '../interfaces/usuarios.interfaces';

@Injectable()
export class ConfiguradorUsuariosService {
  constructor(
    private readonly usuarioRepository: ConfiguradorUsuarioRepository,
    private readonly supabaseAuth: SupabaseAuthService,
  ) {}

  async create(
    dto: CreateUsuarioDto,
    idCreador: string,
  ): Promise<CreateUsuarioResponse> {
    const username = dto.username.trim();
    const correo = dto.correo.trim().toLowerCase();
    const codigoEmpresa = dto.codigoEmpresa?.trim() || null;
    const codigoCuenta = dto.codigoCuenta?.trim() || null;
    const idBodega = dto.idBodega?.trim() || null;

    if (dto.idRol === WmsRol.configurador) {
      throw new BadRequestException(
        'No se puede crear un usuario configurador desde este endpoint',
      );
    }

    const rol = await this.usuarioRepository.findRol(dto.idRol);
    if (!rol) {
      throw new BadRequestException('Rol no válido');
    }

    if (rol.nivel === RolNivel.plataforma) {
      throw new BadRequestException(
        'No se puede crear un usuario de plataforma desde este endpoint',
      );
    }

    const existingUsername =
      await this.usuarioRepository.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('El username ya está en uso');
    }

    const existingCorreo = await this.usuarioRepository.findByCorreo(correo);
    if (existingCorreo) {
      throw new ConflictException('El correo ya está en uso');
    }

    this.validateTenantFields({
      idRol: dto.idRol,
      nivelRol: rol.nivel,
      codigoEmpresa,
      codigoCuenta,
      idBodega,
    });

    if (rol.nivel === RolNivel.cuenta || rol.nivel === RolNivel.bodega) {
      await this.assertCuentaCoherente(codigoEmpresa!, codigoCuenta!);
    }

    if (rol.nivel === RolNivel.bodega) {
      await this.assertBodegaCoherente(idBodega!, codigoCuenta!);
    }

    const idAuth = await this.supabaseAuth.createAuthUser(correo, dto.password);

    try {
      const telefono = dto.telefono?.trim() || null;
      const usuario =
        await this.usuarioRepository.createUsuarioWithOptionalAsignacion({
          idAuth,
          idRol: dto.idRol,
          codigoEmpresa,
          codigoCuenta,
          nombre: dto.nombre,
          username,
          correo,
          telefono,
          idCreador,
          idBodega: idBodega ?? undefined,
        });

      return {
        idUsuario: usuario.idUsuario,
        username: usuario.username,
        nombre: usuario.nombre,
        idRol: usuario.idRol,
        codigoCuenta: usuario.codigoCuenta,
        correo: usuario.correo,
        telefono: usuario.telefono,
      };
    } catch (error) {
      await this.supabaseAuth.deleteAuthUser(idAuth);
      throw error;
    }
  }

  private validateTenantFields(input: {
    idRol: WmsRol;
    nivelRol: RolNivel;
    codigoEmpresa: string | null;
    codigoCuenta: string | null;
    idBodega: string | null;
  }): void {
    const isCuentaRole = (ROLES_NIVEL_CUENTA as readonly WmsRol[]).includes(
      input.idRol,
    );
    const isBodegaRole = (ROLES_NIVEL_BODEGA as readonly WmsRol[]).includes(
      input.idRol,
    );

    if (input.nivelRol === RolNivel.cuenta || isCuentaRole) {
      if (!input.codigoEmpresa || !input.codigoCuenta) {
        throw new BadRequestException(
          'codigoEmpresa y codigoCuenta son obligatorios para roles de cuenta',
        );
      }
    }

    if (input.nivelRol === RolNivel.bodega || isBodegaRole) {
      if (!input.codigoEmpresa || !input.codigoCuenta) {
        throw new BadRequestException(
          'codigoEmpresa y codigoCuenta son obligatorios para roles de bodega',
        );
      }
      if (!input.idBodega) {
        throw new BadRequestException(
          'idBodega es obligatorio para roles de bodega',
        );
      }
    }

    if (
      (input.nivelRol === RolNivel.cuenta || isCuentaRole) &&
      input.idBodega
    ) {
      throw new BadRequestException(
        'idBodega no aplica para roles de nivel cuenta',
      );
    }

    if (input.nivelRol === RolNivel.bodega && !input.idBodega) {
      throw new BadRequestException(
        'idBodega es obligatorio para roles de nivel bodega',
      );
    }
  }

  private async assertCuentaCoherente(
    codigoEmpresa: string,
    codigoCuenta: string,
  ): Promise<void> {
    const cuenta =
      await this.usuarioRepository.findCuentaWithEmpresa(codigoCuenta);

    if (!cuenta) {
      throw new NotFoundException('Cuenta no encontrada');
    }

    if (cuenta.codigoEmpresa !== codigoEmpresa) {
      throw new BadRequestException(
        'codigoCuenta no pertenece a la codigoEmpresa indicada',
      );
    }

    if (!cuenta.empresa.estaActiva) {
      throw new ForbiddenException('La empresa está inactiva');
    }

    if (!cuenta.estaActiva) {
      throw new ForbiddenException('La cuenta está inactiva');
    }
  }

  private async assertBodegaCoherente(
    idBodega: string,
    codigoCuenta: string,
  ): Promise<void> {
    const bodega = await this.usuarioRepository.findBodega(idBodega);

    if (!bodega) {
      throw new NotFoundException('Bodega no encontrada');
    }

    if (bodega.codigoCuenta !== codigoCuenta) {
      throw new BadRequestException(
        'La bodega no pertenece a la cuenta indicada',
      );
    }

    if (!bodega.estaActiva) {
      throw new ForbiddenException('La bodega está inactiva');
    }
  }
}
