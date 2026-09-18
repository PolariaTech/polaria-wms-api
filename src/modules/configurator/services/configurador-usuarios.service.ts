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
import {
  parseProfileTelefono,
  TELEFONO_DUPLICADO,
  TELEFONO_INVALIDO,
} from '../../../shared/utils/phone.util';
import { CreateUsuarioDto } from '../dto/create-usuario.dto';
import { ConfiguradorUsuarioRepository } from '../infrastructure/configurador-usuario.repository';
import type {
  CreateUsuarioResponse,
  UpdateUsuarioInput,
} from '../interfaces/usuarios.interfaces';

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

    const parsedPhone = parseProfileTelefono(dto.telefono);
    if (parsedPhone.kind === 'invalid') {
      throw new BadRequestException(TELEFONO_INVALIDO);
    }
    const telefono = parsedPhone.kind === 'ok' ? parsedPhone.value : null;
    if (telefono) {
      const existingTelefono =
        await this.usuarioRepository.findByTelefono(telefono);
      if (existingTelefono) {
        throw new ConflictException(TELEFONO_DUPLICADO);
      }
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

    const accesoWms = dto.accesoWms !== false;
    const accesoMateo = dto.accesoMateo !== false;
    this.assertProductoAccess(accesoWms, accesoMateo);

    const idAuth = await this.supabaseAuth.createAuthUser(correo, dto.password);

    try {
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
          accesoWms,
          accesoMateo,
        });

      return this.toResponse(usuario);
    } catch (error) {
      await this.supabaseAuth.deleteAuthUser(idAuth);
      throw error;
    }
  }

  async update(
    idUsuario: string,
    dto: UpdateUsuarioInput,
  ): Promise<CreateUsuarioResponse> {
    const usuario = await this.usuarioRepository.findById(idUsuario);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const nombre = dto.nombre !== undefined ? dto.nombre.trim() : undefined;
    const correo =
      dto.correo !== undefined ? dto.correo.trim().toLowerCase() : undefined;
    let telefono: string | null | undefined;
    if (dto.telefono !== undefined) {
      const parsedPhone = parseProfileTelefono(dto.telefono);
      if (parsedPhone.kind === 'invalid') {
        throw new BadRequestException(TELEFONO_INVALIDO);
      }
      telefono = parsedPhone.kind === 'ok' ? parsedPhone.value : null;
    }

    if (nombre !== undefined && !nombre) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    if (correo !== undefined && !correo) {
      throw new BadRequestException('El correo es obligatorio');
    }

    const accesoWms = dto.accesoWms ?? usuario.accesoWms ?? true;
    const accesoMateo = dto.accesoMateo ?? usuario.accesoMateo ?? true;
    if (dto.accesoWms !== undefined || dto.accesoMateo !== undefined) {
      this.assertProductoAccess(accesoWms, accesoMateo);
    }

    if (
      nombre === undefined &&
      correo === undefined &&
      telefono === undefined &&
      dto.estaActivo === undefined &&
      dto.accesoWms === undefined &&
      dto.accesoMateo === undefined
    ) {
      throw new BadRequestException(
        'Debes indicar al menos un campo para actualizar',
      );
    }

    if (correo && correo !== usuario.correo) {
      const existingCorreo = await this.usuarioRepository.findByCorreo(correo);
      if (existingCorreo && existingCorreo.idUsuario !== idUsuario) {
        throw new ConflictException('El correo ya está en uso');
      }
    }

    if (telefono) {
      const existingTelefono =
        await this.usuarioRepository.findByTelefono(telefono);
      if (existingTelefono && existingTelefono.idUsuario !== idUsuario) {
        throw new ConflictException(TELEFONO_DUPLICADO);
      }
    }

    const previousCorreo = usuario.correo;
    const correoChanged = Boolean(correo && correo !== previousCorreo);

    if (correoChanged && correo) {
      await this.supabaseAuth.updateAuthUser(usuario.idAuth, { email: correo });
    }

    try {
      const updated = await this.usuarioRepository.updateUsuario(idUsuario, {
        ...(nombre !== undefined ? { nombre } : {}),
        ...(correoChanged && correo ? { correo } : {}),
        ...(telefono !== undefined ? { telefono } : {}),
        ...(dto.estaActivo !== undefined ? { estaActivo: dto.estaActivo } : {}),
        ...(dto.accesoWms !== undefined ? { accesoWms } : {}),
        ...(dto.accesoMateo !== undefined ? { accesoMateo } : {}),
      });

      return this.toResponse(updated);
    } catch (error) {
      if (correoChanged) {
        await this.supabaseAuth.updateAuthUser(usuario.idAuth, {
          email: previousCorreo,
        });
      }
      throw error;
    }
  }

  async resetPassword(
    idUsuario: string,
    password: string,
  ): Promise<CreateUsuarioResponse> {
    const usuario = await this.usuarioRepository.findById(idUsuario);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const clave = password.trim();
    if (clave.length < 8) {
      throw new BadRequestException(
        'La clave debe tener al menos 8 caracteres',
      );
    }

    await this.supabaseAuth.updateAuthUser(usuario.idAuth, { password: clave });
    return this.toResponse(usuario);
  }

  private toResponse(usuario: {
    idUsuario: string;
    username: string;
    nombre: string;
    idRol: WmsRol;
    codigoCuenta: string | null;
    correo: string;
    telefono: string | null;
    estaActivo?: boolean;
    accesoWms?: boolean;
    accesoMateo?: boolean;
  }): CreateUsuarioResponse {
    return {
      idUsuario: usuario.idUsuario,
      username: usuario.username,
      nombre: usuario.nombre,
      idRol: usuario.idRol,
      codigoCuenta: usuario.codigoCuenta,
      correo: usuario.correo,
      telefono: usuario.telefono,
      estaActivo: usuario.estaActivo ?? true,
      accesoWms: usuario.accesoWms ?? true,
      accesoMateo: usuario.accesoMateo ?? true,
    };
  }

  private assertProductoAccess(accesoWms: boolean, accesoMateo: boolean): void {
    if (!accesoWms && !accesoMateo) {
      throw new BadRequestException(
        'El usuario debe tener acceso a Polaria WMS, a Mateo IA, o a ambos.',
      );
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
    const cuenta = await this.usuarioRepository.findCuentaWithEmpresa(
      codigoCuenta,
      codigoEmpresa,
    );

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
