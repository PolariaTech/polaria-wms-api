import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import { SupabaseAuthService } from '../../../core/auth/supabase-auth.service';
import { ConfiguradorUsuarioRepository } from '../infrastructure/configurador-usuario.repository';
import { ConfiguradorUsuariosService } from './configurador-usuarios.service';

describe('ConfiguradorUsuariosService', () => {
  let service: ConfiguradorUsuariosService;
  let repository: jest.Mocked<ConfiguradorUsuarioRepository>;
  let supabaseAuth: jest.Mocked<SupabaseAuthService>;

  const idCreador = 'creator-uuid';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfiguradorUsuariosService,
        {
          provide: ConfiguradorUsuarioRepository,
          useValue: {
            findByUsername: jest.fn(),
            findByCorreo: jest.fn(),
            findRol: jest.fn(),
            findCuentaWithEmpresa: jest.fn(),
            findBodega: jest.fn(),
            createUsuarioWithOptionalAsignacion: jest.fn(),
          },
        },
        {
          provide: SupabaseAuthService,
          useValue: {
            createAuthUser: jest.fn(),
            deleteAuthUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ConfiguradorUsuariosService);
    repository = module.get(ConfiguradorUsuarioRepository);
    supabaseAuth = module.get(SupabaseAuthService);
  });

  const baseDto = {
    username: 'operario.b1',
    nombre: 'Operario Uno',
    idRol: WmsRol.operario,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    idBodega: 'bodega-uuid',
    correo: 'operario@test.com',
    password: 'secret1',
  };

  it('rechaza creación de rol configurador', async () => {
    await expect(
      service.create({ ...baseDto, idRol: WmsRol.configurador }, idCreador),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza username duplicado', async () => {
    repository.findRol.mockResolvedValue({
      idRol: WmsRol.operario,
      nombre: 'Operario',
      nivel: RolNivel.bodega,
      puedeCrearRol: null,
      descripcion: null,
    });
    repository.findByUsername.mockResolvedValue({ idUsuario: 'x' } as never);

    await expect(service.create(baseDto, idCreador)).rejects.toThrow(
      ConflictException,
    );
  });

  it('rechaza correo duplicado', async () => {
    repository.findRol.mockResolvedValue({
      idRol: WmsRol.operario,
      nombre: 'Operario',
      nivel: RolNivel.bodega,
      puedeCrearRol: null,
      descripcion: null,
    });
    repository.findByUsername.mockResolvedValue(null);
    repository.findByCorreo.mockResolvedValue({ idUsuario: 'x' } as never);

    await expect(service.create(baseDto, idCreador)).rejects.toThrow(
      ConflictException,
    );
  });

  it('rechaza rol cuenta sin codigoCuenta', async () => {
    repository.findRol.mockResolvedValue({
      idRol: WmsRol.administrador_cuenta,
      nombre: 'Admin cuenta',
      nivel: RolNivel.cuenta,
      puedeCrearRol: null,
      descripcion: null,
    });
    repository.findByUsername.mockResolvedValue(null);
    repository.findByCorreo.mockResolvedValue(null);

    await expect(
      service.create(
        {
          ...baseDto,
          idRol: WmsRol.administrador_cuenta,
          codigoCuenta: undefined,
          idBodega: undefined,
        },
        idCreador,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza cuenta incoherente con empresa', async () => {
    repository.findRol.mockResolvedValue({
      idRol: WmsRol.administrador_cuenta,
      nombre: 'Admin cuenta',
      nivel: RolNivel.cuenta,
      puedeCrearRol: null,
      descripcion: null,
    });
    repository.findByUsername.mockResolvedValue(null);
    repository.findByCorreo.mockResolvedValue(null);
    repository.findCuentaWithEmpresa.mockResolvedValue({
      codigoCuenta: 'CTA001',
      codigoEmpresa: 'EMP999',
      estaActiva: true,
      empresa: { estaActiva: true },
    } as never);

    await expect(
      service.create(
        {
          ...baseDto,
          idRol: WmsRol.administrador_cuenta,
          idBodega: undefined,
        },
        idCreador,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza rol bodega sin idBodega', async () => {
    repository.findRol.mockResolvedValue({
      idRol: WmsRol.operario,
      nombre: 'Operario',
      nivel: RolNivel.bodega,
      puedeCrearRol: null,
      descripcion: null,
    });
    repository.findByUsername.mockResolvedValue(null);
    repository.findByCorreo.mockResolvedValue(null);

    await expect(
      service.create({ ...baseDto, idBodega: undefined }, idCreador),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza bodega de otra cuenta', async () => {
    repository.findRol.mockResolvedValue({
      idRol: WmsRol.operario,
      nombre: 'Operario',
      nivel: RolNivel.bodega,
      puedeCrearRol: null,
      descripcion: null,
    });
    repository.findByUsername.mockResolvedValue(null);
    repository.findByCorreo.mockResolvedValue(null);
    repository.findCuentaWithEmpresa.mockResolvedValue({
      codigoCuenta: 'CTA001',
      codigoEmpresa: 'EMP001',
      estaActiva: true,
      empresa: { estaActiva: true },
    } as never);
    repository.findBodega.mockResolvedValue({
      idBodega: 'bodega-uuid',
      codigoCuenta: 'CTA999',
      estaActiva: true,
    } as never);

    await expect(service.create(baseDto, idCreador)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza cuenta inactiva', async () => {
    repository.findRol.mockResolvedValue({
      idRol: WmsRol.administrador_cuenta,
      nombre: 'Admin cuenta',
      nivel: RolNivel.cuenta,
      puedeCrearRol: null,
      descripcion: null,
    });
    repository.findByUsername.mockResolvedValue(null);
    repository.findByCorreo.mockResolvedValue(null);
    repository.findCuentaWithEmpresa.mockResolvedValue({
      codigoCuenta: 'CTA001',
      codigoEmpresa: 'EMP001',
      estaActiva: false,
      empresa: { estaActiva: true },
    } as never);

    await expect(
      service.create(
        { ...baseDto, idRol: WmsRol.administrador_cuenta, idBodega: undefined },
        idCreador,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza bodega inexistente', async () => {
    repository.findRol.mockResolvedValue({
      idRol: WmsRol.operario,
      nombre: 'Operario',
      nivel: RolNivel.bodega,
      puedeCrearRol: null,
      descripcion: null,
    });
    repository.findByUsername.mockResolvedValue(null);
    repository.findByCorreo.mockResolvedValue(null);
    repository.findCuentaWithEmpresa.mockResolvedValue({
      codigoCuenta: 'CTA001',
      codigoEmpresa: 'EMP001',
      estaActiva: true,
      empresa: { estaActiva: true },
    } as never);
    repository.findBodega.mockResolvedValue(null);

    await expect(service.create(baseDto, idCreador)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('crea usuario operario con asignación de bodega', async () => {
    repository.findRol.mockResolvedValue({
      idRol: WmsRol.operario,
      nombre: 'Operario',
      nivel: RolNivel.bodega,
      puedeCrearRol: null,
      descripcion: null,
    });
    repository.findByUsername.mockResolvedValue(null);
    repository.findByCorreo.mockResolvedValue(null);
    repository.findCuentaWithEmpresa.mockResolvedValue({
      codigoCuenta: 'CTA001',
      codigoEmpresa: 'EMP001',
      estaActiva: true,
      empresa: { estaActiva: true },
    } as never);
    repository.findBodega.mockResolvedValue({
      idBodega: 'bodega-uuid',
      codigoCuenta: 'CTA001',
      estaActiva: true,
    } as never);
    supabaseAuth.createAuthUser.mockResolvedValue('auth-new');
    repository.createUsuarioWithOptionalAsignacion.mockResolvedValue({
      idUsuario: 'usr-new',
      username: 'operario.b1',
      nombre: 'Operario Uno',
      idRol: WmsRol.operario,
      codigoCuenta: 'CTA001',
      correo: 'operario@test.com',
      telefono: null,
    } as never);

    const result = await service.create(baseDto, idCreador);

    expect(result).toEqual({
      idUsuario: 'usr-new',
      username: 'operario.b1',
      nombre: 'Operario Uno',
      idRol: WmsRol.operario,
      codigoCuenta: 'CTA001',
      correo: 'operario@test.com',
      telefono: null,
    });
    expect(supabaseAuth.createAuthUser).toHaveBeenCalledWith(
      'operario@test.com',
      'secret1',
    );
    expect(repository.createUsuarioWithOptionalAsignacion).toHaveBeenCalledWith(
      expect.objectContaining({
        idAuth: 'auth-new',
        idBodega: 'bodega-uuid',
        idCreador,
        telefono: null,
      }),
    );
  });

  it('elimina usuario Auth si falla Prisma', async () => {
    repository.findRol.mockResolvedValue({
      idRol: WmsRol.administrador_cuenta,
      nombre: 'Admin cuenta',
      nivel: RolNivel.cuenta,
      puedeCrearRol: null,
      descripcion: null,
    });
    repository.findByUsername.mockResolvedValue(null);
    repository.findByCorreo.mockResolvedValue(null);
    repository.findCuentaWithEmpresa.mockResolvedValue({
      codigoCuenta: 'CTA001',
      codigoEmpresa: 'EMP001',
      estaActiva: true,
      empresa: { estaActiva: true },
    } as never);
    supabaseAuth.createAuthUser.mockResolvedValue('auth-new');
    repository.createUsuarioWithOptionalAsignacion.mockRejectedValue(
      new Error('db fail'),
    );

    await expect(
      service.create(
        {
          ...baseDto,
          idRol: WmsRol.administrador_cuenta,
          idBodega: undefined,
        },
        idCreador,
      ),
    ).rejects.toThrow('db fail');

    expect(supabaseAuth.deleteAuthUser).toHaveBeenCalledWith('auth-new');
  });
});
