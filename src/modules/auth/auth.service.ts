import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SupabaseAuthService } from '../../core/auth/supabase-auth.service';
import {
  AUTH_CLIENT,
  type AuthClient,
} from '../../shared/constants/auth-client.constants';
import {
  AUTH_FLOW,
  AUTH_SCOPE,
  ROL_CONFIGURADOR,
} from '../../shared/constants/auth.constants';
import { isValidEmail } from '../../shared/utils/email.util';
import { LoginDto } from './dto/login.dto';
import { PreloginDto } from './dto/prelogin.dto';
import type {
  LoginResponse,
  MateoExchangeResponse,
  MateoHandoffResponse,
  MateoWidgetTokenResponse,
  MeResponse,
  PreloginResponse,
  SessionContext,
  UserPreview,
  ValidatedUserContext,
} from './interfaces/auth.interfaces';
import {
  UsuarioRepository,
  UsuarioWithRelations,
} from './infrastructure/usuario.repository';
import { MateoHandoffService } from './mateo-handoff.service';
import { MateoWidgetTokenService } from './mateo-widget-token.service';
import type { TenantContext } from '../../core/tenant/tenant-context.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usuarioRepository: UsuarioRepository,
    private readonly supabaseAuth: SupabaseAuthService,
    private readonly mateoHandoffService: MateoHandoffService,
    private readonly mateoWidgetTokenService: MateoWidgetTokenService,
  ) {}

  async prelogin(
    dto: PreloginDto,
    client: AuthClient | null = null,
  ): Promise<PreloginResponse> {
    const context = await this.validateUserAccess(
      dto.identificador,
      dto.codigoEmpresa,
      client,
    );

    return {
      ok: true,
      requiresPassword: true,
      flow: context.flow,
      userPreview: this.toUserPreview(context.usuario),
    };
  }

  async login(
    dto: LoginDto,
    client: AuthClient | null = null,
  ): Promise<LoginResponse> {
    const context = await this.validateUserAccess(
      dto.identificador,
      dto.codigoEmpresa,
      client,
    );

    const tokens = await this.supabaseAuth.signInWithPassword(
      context.usuario.correo,
      dto.password,
    );

    this.logger.log(
      `Login exitoso: usuario=${context.usuario.idUsuario} scope=${context.scope} client=${client ?? 'legacy'}`,
    );

    return {
      ...tokens,
      context: this.toSessionContext(context),
    };
  }

  async createMateoHandoff(idAuth: string): Promise<MateoHandoffResponse> {
    const usuario = await this.usuarioRepository.findActiveByIdAuth(idAuth);

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado o inactivo');
    }

    return this.mateoHandoffService.generateCode(idAuth);
  }

  async createMateoWidgetToken(
    idAuth: string,
  ): Promise<MateoWidgetTokenResponse> {
    const usuario = await this.usuarioRepository.findActiveByIdAuth(idAuth);

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado o inactivo');
    }

    return this.mateoWidgetTokenService.generateToken({
      idAuth: usuario.idAuth,
      idUsuario: usuario.idUsuario,
      codigoEmpresa: usuario.codigoEmpresa,
      codigoCuenta: usuario.codigoCuenta,
      idRol: usuario.idRol,
      correo: usuario.correo,
      nombre: usuario.nombre,
    });
  }

  async exchangeMateoCode(code: string): Promise<MateoExchangeResponse> {
    const idAuth = this.mateoHandoffService.redeemCode(code);
    const usuario = await this.usuarioRepository.findActiveByIdAuth(idAuth);

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado o inactivo');
    }

    const tokens = await this.supabaseAuth.createSessionForEmail(
      usuario.correo,
    );

    this.logger.log(`Exchange Mateo exitoso: usuario=${usuario.idUsuario}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toMateoExchangeUser(usuario),
    };
  }

  async getMe(ctx: TenantContext): Promise<MeResponse> {
    const usuario = await this.usuarioRepository.findActiveByIdUsuario(
      ctx.idUsuario,
    );

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado o inactivo');
    }

    const isConfigurador = this.usuarioRepository.isConfigurador(usuario.idRol);

    return {
      idUsuario: usuario.idUsuario,
      idAuth: usuario.idAuth,
      nombre: usuario.nombre,
      username: usuario.username,
      correo: usuario.correo,
      idRol: usuario.idRol,
      nombreRol: usuario.rol.nombre,
      nivelRol: usuario.rol.nivel,
      codigoEmpresa: isConfigurador ? null : usuario.codigoEmpresa,
      razonSocialEmpresa: isConfigurador
        ? null
        : (usuario.empresa?.razonSocial ?? null),
      codigoCuenta: isConfigurador ? null : usuario.codigoCuenta,
      nombreComercialCuenta: isConfigurador
        ? null
        : (usuario.cuenta?.nombreComercial ?? null),
      scope: isConfigurador ? AUTH_SCOPE.PLATFORM : AUTH_SCOPE.TENANT,
      idBodegas: ctx.idBodegas,
    };
  }

  async logout(accessToken: string): Promise<void> {
    await this.supabaseAuth.signOut(accessToken);
    this.logger.log('Sesión cerrada correctamente');
  }

  private async resolveUsuario(
    identificador: string,
    client: AuthClient | null,
  ): Promise<UsuarioWithRelations | null> {
    const normalized = identificador.trim();

    if (client === AUTH_CLIENT.WMS) {
      if (!isValidEmail(normalized)) {
        throw new BadRequestException(
          'El identificador debe ser un correo electrónico válido',
        );
      }

      return this.usuarioRepository.findActiveByCorreo(normalized);
    }

    if (client === AUTH_CLIENT.MATEO) {
      if (isValidEmail(normalized)) {
        throw new BadRequestException(
          'Mateo requiere nombre de usuario, no correo electrónico',
        );
      }

      return this.usuarioRepository.findActiveByUsername(normalized);
    }

    return this.usuarioRepository.findActiveByIdentificador(normalized);
  }

  private async validateUserAccess(
    identificador: string,
    codigoEmpresa: string | undefined,
    client: AuthClient | null = null,
  ): Promise<ValidatedUserContext> {
    const usuario = await this.resolveUsuario(identificador, client);

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado o inactivo');
    }

    const isConfigurador = this.usuarioRepository.isConfigurador(usuario.idRol);

    if (isConfigurador) {
      return {
        usuario,
        flow: AUTH_FLOW.PLATFORM,
        scope: AUTH_SCOPE.PLATFORM,
      };
    }

    if (!codigoEmpresa?.trim()) {
      throw new UnprocessableEntityException(
        'codigoEmpresa es obligatorio para usuarios de tenant',
      );
    }

    const codigoEmpresaNormalizado = codigoEmpresa.trim();

    if (usuario.codigoEmpresa !== codigoEmpresaNormalizado) {
      throw new ForbiddenException(
        'El usuario no pertenece a la empresa indicada',
      );
    }

    if (!usuario.empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    if (!usuario.empresa.estaActiva) {
      throw new ForbiddenException('La empresa está inactiva');
    }

    if (usuario.codigoCuenta && usuario.cuenta && !usuario.cuenta.estaActiva) {
      throw new ForbiddenException('La cuenta está inactiva');
    }

    return {
      usuario,
      flow: AUTH_FLOW.TENANT,
      scope: AUTH_SCOPE.TENANT,
    };
  }

  private toUserPreview(usuario: UsuarioWithRelations): UserPreview {
    const isConfigurador = usuario.idRol === ROL_CONFIGURADOR;

    return {
      idUsuario: usuario.idUsuario,
      nombre: usuario.nombre,
      username: usuario.username,
      idRol: usuario.idRol,
      nombreRol: usuario.rol.nombre,
      codigoEmpresa: isConfigurador ? null : usuario.codigoEmpresa,
      codigoCuenta: isConfigurador ? null : usuario.codigoCuenta,
    };
  }

  private toSessionContext(context: ValidatedUserContext): SessionContext {
    const isConfigurador = this.usuarioRepository.isConfigurador(
      context.usuario.idRol,
    );

    return {
      idUsuario: context.usuario.idUsuario,
      idRol: context.usuario.idRol,
      codigoEmpresa: isConfigurador ? null : context.usuario.codigoEmpresa,
      codigoCuenta: isConfigurador ? null : context.usuario.codigoCuenta,
      scope: context.scope,
    };
  }

  private toMateoExchangeUser(usuario: UsuarioWithRelations) {
    const isConfigurador = this.usuarioRepository.isConfigurador(usuario.idRol);

    return {
      idUsuario: usuario.idUsuario,
      username: usuario.username,
      nombre: usuario.nombre,
      correo: usuario.correo,
      nombreRol: usuario.rol.nombre,
      codigoEmpresa: isConfigurador ? null : usuario.codigoEmpresa,
      codigoCuenta: isConfigurador ? null : usuario.codigoCuenta,
      scope: isConfigurador ? AUTH_SCOPE.PLATFORM : AUTH_SCOPE.TENANT,
    };
  }
}
