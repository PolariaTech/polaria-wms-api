import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthService } from '../../core/auth/supabase-auth.service';
import { AUTH_CLIENT } from '../../shared/constants/auth-client.constants';
import { WmsRol } from '../../generated/prisma/client';
import { AuthService } from './auth.service';
import { UsuarioRepository } from './infrastructure/usuario.repository';
import { MateoHandoffService } from './mateo-handoff.service';

const mockConfigurador = {
  idUsuario: 'usr-config',
  idAuth: 'auth-config',
  idRol: WmsRol.configurador,
  codigoEmpresa: null,
  codigoCuenta: null,
  nombre: 'Config TI',
  username: 'config.ti',
  correo: 'config@polaria.tech',
  estaActivo: true,
  rol: {
    idRol: WmsRol.configurador,
    nombre: 'Configurador (TI)',
    nivel: 'plataforma',
  },
  empresa: null,
  cuenta: null,
};

const mockTenantUser = {
  idUsuario: 'usr-tenant',
  idAuth: 'auth-tenant',
  idRol: WmsRol.administrador_cuenta,
  codigoEmpresa: 'EMP001',
  codigoCuenta: null,
  nombre: 'Admin Cuenta',
  username: 'admin.cuenta',
  correo: 'admin@empresa.com',
  estaActivo: true,
  rol: {
    idRol: WmsRol.administrador_cuenta,
    nombre: 'Administrador de cuenta',
    nivel: 'cuenta',
  },
  empresa: {
    codigoEmpresa: 'EMP001',
    razonSocial: 'Empresa Demo SA',
    estaActiva: true,
  },
  cuenta: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let usuarioRepository: jest.Mocked<UsuarioRepository>;
  let supabaseAuth: jest.Mocked<SupabaseAuthService>;
  let mateoHandoffService: jest.Mocked<MateoHandoffService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsuarioRepository,
          useValue: {
            findActiveByIdentificador: jest.fn(),
            findActiveByUsername: jest.fn(),
            findActiveByCorreo: jest.fn(),
            findActiveByIdAuth: jest.fn(),
            findActiveByIdUsuario: jest.fn(),
            isConfigurador: jest.fn(
              (idRol: string) => idRol === WmsRol.configurador,
            ),
          },
        },
        {
          provide: SupabaseAuthService,
          useValue: {
            signInWithPassword: jest.fn(),
            createSessionForEmail: jest.fn(),
            getUserFromToken: jest.fn(),
            signOut: jest.fn(),
          },
        },
        {
          provide: MateoHandoffService,
          useValue: {
            generateCode: jest.fn(),
            redeemCode: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usuarioRepository = module.get(UsuarioRepository);
    supabaseAuth = module.get(SupabaseAuthService);
    mateoHandoffService = module.get(MateoHandoffService);
  });

  describe('prelogin', () => {
    it('retorna flow platform para configurador sin codigoEmpresa', async () => {
      usuarioRepository.findActiveByIdentificador.mockResolvedValue(
        mockConfigurador as never,
      );

      const result = await service.prelogin({ identificador: 'config.ti' });

      expect(result).toEqual({
        ok: true,
        requiresPassword: true,
        flow: 'platform',
        userPreview: {
          idUsuario: 'usr-config',
          nombre: 'Config TI',
          username: 'config.ti',
          idRol: WmsRol.configurador,
          nombreRol: 'Configurador (TI)',
          codigoEmpresa: null,
          codigoCuenta: null,
        },
      });
    });

    it('retorna flow tenant cuando codigoEmpresa coincide', async () => {
      usuarioRepository.findActiveByIdentificador.mockResolvedValue(
        mockTenantUser as never,
      );

      const result = await service.prelogin({
        identificador: 'admin.cuenta',
        codigoEmpresa: 'EMP001',
      });

      expect(result.flow).toBe('tenant');
      expect(result.userPreview.codigoEmpresa).toBe('EMP001');
    });

    it('client=wms rechaza username sin @', async () => {
      await expect(
        service.prelogin({ identificador: 'admin.cuenta' }, AUTH_CLIENT.WMS),
      ).rejects.toThrow(BadRequestException);

      expect(usuarioRepository.findActiveByCorreo).not.toHaveBeenCalled();
    });

    it('client=wms busca por correo', async () => {
      usuarioRepository.findActiveByCorreo.mockResolvedValue(
        mockTenantUser as never,
      );

      const result = await service.prelogin(
        {
          identificador: 'admin@empresa.com',
          codigoEmpresa: 'EMP001',
        },
        AUTH_CLIENT.WMS,
      );

      expect(usuarioRepository.findActiveByCorreo).toHaveBeenCalledWith(
        'admin@empresa.com',
      );
      expect(result.flow).toBe('tenant');
    });

    it('client=mateo rechaza correo como identificador', async () => {
      await expect(
        service.prelogin(
          { identificador: 'admin@empresa.com', codigoEmpresa: 'EMP001' },
          AUTH_CLIENT.MATEO,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(usuarioRepository.findActiveByUsername).not.toHaveBeenCalled();
    });

    it('client=mateo busca por username', async () => {
      usuarioRepository.findActiveByUsername.mockResolvedValue(
        mockTenantUser as never,
      );

      const result = await service.prelogin(
        {
          identificador: 'admin.cuenta',
          codigoEmpresa: 'EMP001',
        },
        AUTH_CLIENT.MATEO,
      );

      expect(usuarioRepository.findActiveByUsername).toHaveBeenCalledWith(
        'admin.cuenta',
      );
      expect(result.flow).toBe('tenant');
    });

    it('lanza 404 si usuario no existe', async () => {
      usuarioRepository.findActiveByIdentificador.mockResolvedValue(null);

      await expect(
        service.prelogin({ identificador: 'inexistente' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 422 si tenant no envía codigoEmpresa', async () => {
      usuarioRepository.findActiveByIdentificador.mockResolvedValue(
        mockTenantUser as never,
      );

      await expect(
        service.prelogin({ identificador: 'admin.cuenta' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('lanza 403 si codigoEmpresa no coincide', async () => {
      usuarioRepository.findActiveByIdentificador.mockResolvedValue(
        mockTenantUser as never,
      );

      await expect(
        service.prelogin({
          identificador: 'admin.cuenta',
          codigoEmpresa: 'OTRA',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza 403 si empresa está inactiva', async () => {
      usuarioRepository.findActiveByIdentificador.mockResolvedValue({
        ...mockTenantUser,
        empresa: { ...mockTenantUser.empresa, estaActiva: false },
      } as never);

      await expect(
        service.prelogin({
          identificador: 'admin.cuenta',
          codigoEmpresa: 'EMP001',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('login', () => {
    it('autentica y retorna tokens + contexto tenant', async () => {
      usuarioRepository.findActiveByIdentificador.mockResolvedValue(
        mockTenantUser as never,
      );
      supabaseAuth.signInWithPassword.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenType: 'bearer',
      });

      const result = await service.login({
        identificador: 'admin.cuenta',
        codigoEmpresa: 'EMP001',
        password: 'secret',
      });

      expect(supabaseAuth.signInWithPassword).toHaveBeenCalledWith(
        'admin@empresa.com',
        'secret',
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.context).toEqual({
        idUsuario: 'usr-tenant',
        idRol: WmsRol.administrador_cuenta,
        codigoEmpresa: 'EMP001',
        codigoCuenta: null,
        scope: 'tenant',
      });
    });

    it('propaga 401 de Supabase Auth', async () => {
      usuarioRepository.findActiveByIdentificador.mockResolvedValue(
        mockConfigurador as never,
      );
      supabaseAuth.signInWithPassword.mockRejectedValue(
        new UnauthorizedException('Credenciales inválidas'),
      );

      await expect(
        service.login({
          identificador: 'config.ti',
          password: 'wrong',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createMateoHandoff', () => {
    it('genera código para usuario activo', async () => {
      usuarioRepository.findActiveByIdAuth.mockResolvedValue(
        mockTenantUser as never,
      );
      mateoHandoffService.generateCode.mockReturnValue({
        code: 'handoff-code',
        expiresIn: 60,
      });

      const result = await service.createMateoHandoff('auth-tenant');

      expect(mateoHandoffService.generateCode).toHaveBeenCalledWith(
        'auth-tenant',
      );
      expect(result).toEqual({ code: 'handoff-code', expiresIn: 60 });
    });

    it('genera el mismo handoff para idAuth sin importar cliente de login (wms vs mateo)', async () => {
      usuarioRepository.findActiveByIdAuth.mockResolvedValue(
        mockTenantUser as never,
      );
      mateoHandoffService.generateCode.mockReturnValue({
        code: 'handoff-code',
        expiresIn: 60,
      });

      const fromWmsSession = await service.createMateoHandoff('auth-tenant');
      const fromMateoSession = await service.createMateoHandoff('auth-tenant');

      expect(fromWmsSession).toEqual(fromMateoSession);
      expect(mateoHandoffService.generateCode).toHaveBeenCalledTimes(2);
      expect(mateoHandoffService.generateCode).toHaveBeenNthCalledWith(
        1,
        'auth-tenant',
      );
      expect(mateoHandoffService.generateCode).toHaveBeenNthCalledWith(
        2,
        'auth-tenant',
      );
    });

    it('lanza 404 si usuario no existe', async () => {
      usuarioRepository.findActiveByIdAuth.mockResolvedValue(null);

      await expect(service.createMateoHandoff('auth-unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('exchangeMateoCode', () => {
    it('canjea código y retorna tokens + usuario', async () => {
      mateoHandoffService.redeemCode.mockReturnValue('auth-tenant');
      usuarioRepository.findActiveByIdAuth.mockResolvedValue(
        mockTenantUser as never,
      );
      supabaseAuth.createSessionForEmail.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenType: 'bearer',
      });

      const result = await service.exchangeMateoCode('valid-code');

      expect(supabaseAuth.createSessionForEmail).toHaveBeenCalledWith(
        'admin@empresa.com',
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          idUsuario: 'usr-tenant',
          username: 'admin.cuenta',
          nombre: 'Admin Cuenta',
          correo: 'admin@empresa.com',
          nombreRol: 'Administrador de cuenta',
          codigoEmpresa: 'EMP001',
          codigoCuenta: null,
          scope: 'tenant',
        },
      });
    });

    it('propaga 401 si el código es inválido', async () => {
      mateoHandoffService.redeemCode.mockImplementation(() => {
        throw new UnauthorizedException('Código inválido o expirado');
      });

      await expect(service.exchangeMateoCode('bad-code')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getMe', () => {
    const tenantContext = {
      idUsuario: 'usr-tenant',
      idRol: WmsRol.administrador_cuenta,
      nivelRol: 'cuenta' as const,
      codigoEmpresa: 'EMP001',
      codigoCuenta: null,
      idBodegas: ['bodega-1'],
    };

    const configuradorContext = {
      idUsuario: 'usr-config',
      idRol: WmsRol.configurador,
      nivelRol: 'plataforma' as const,
      codigoEmpresa: null,
      codigoCuenta: null,
      idBodegas: [],
    };

    it('retorna scope platform para configurador', async () => {
      usuarioRepository.findActiveByIdUsuario.mockResolvedValue(
        mockConfigurador as never,
      );

      const result = await service.getMe(configuradorContext);

      expect(result.scope).toBe('platform');
      expect(result.codigoEmpresa).toBeNull();
      expect(result.codigoCuenta).toBeNull();
      expect(result.idBodegas).toEqual([]);
    });

    it('retorna scope tenant con datos de empresa e idBodegas', async () => {
      usuarioRepository.findActiveByIdUsuario.mockResolvedValue(
        mockTenantUser as never,
      );

      const result = await service.getMe(tenantContext);

      expect(result.scope).toBe('tenant');
      expect(result.razonSocialEmpresa).toBe('Empresa Demo SA');
      expect(result.idBodegas).toEqual(['bodega-1']);
    });

    it('lanza 404 si no hay usuario activo', async () => {
      usuarioRepository.findActiveByIdUsuario.mockResolvedValue(null);

      await expect(service.getMe(tenantContext)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('logout', () => {
    it('delega cierre de sesión a Supabase', async () => {
      supabaseAuth.signOut.mockResolvedValue(undefined);

      await service.logout('access-token');

      expect(supabaseAuth.signOut).toHaveBeenCalledWith('access-token');
    });
  });
});
