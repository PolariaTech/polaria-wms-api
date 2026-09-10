import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import { ConfiguradorUsuarioRepository } from '../infrastructure/configurador-usuario.repository';
import { AdministracionUsuariosService } from './administracion-usuarios.service';
import { ConfiguradorUsuariosService } from './configurador-usuarios.service';

describe('AdministracionUsuariosService', () => {
  let service: AdministracionUsuariosService;
  let configuradorUsuariosService: jest.Mocked<
    Pick<ConfiguradorUsuariosService, 'create' | 'update' | 'resetPassword'>
  >;
  let usuarioRepository: jest.Mocked<
    Pick<ConfiguradorUsuarioRepository, 'findById'>
  >;

  const adminContext = {
    idUsuario: 'usr-admin',
    idRol: WmsRol.administrador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    idBodegas: [],
  };

  const baseDto = {
    username: 'operador.c1',
    nombre: 'Operador Cuenta',
    correo: 'operador@test.com',
    telefono: '+573001112233',
    password: 'ClaveSegura1!',
  };

  beforeEach(async () => {
    configuradorUsuariosService = {
      create: jest.fn(),
      update: jest.fn(),
      resetPassword: jest.fn(),
    };
    usuarioRepository = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministracionUsuariosService,
        {
          provide: ConfiguradorUsuariosService,
          useValue: configuradorUsuariosService,
        },
        {
          provide: ConfiguradorUsuarioRepository,
          useValue: usuarioRepository,
        },
      ],
    }).compile();

    service = module.get(AdministracionUsuariosService);
    configuradorUsuariosService.create.mockResolvedValue({
      idUsuario: 'usr-new',
      username: baseDto.username,
      nombre: baseDto.nombre,
      idRol: WmsRol.operador_cuenta,
      codigoCuenta: 'CTA001',
      correo: baseDto.correo,
      telefono: baseDto.telefono,
    });
  });

  it('usa operador_cuenta por defecto cuando idRol no se envía', async () => {
    await service.create(baseDto, adminContext);

    expect(configuradorUsuariosService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idRol: WmsRol.operador_cuenta,
        codigoEmpresa: 'EMP001',
        codigoCuenta: 'CTA001',
        telefono: '+573001112233',
      }),
      adminContext.idUsuario,
    );
  });

  it('respeta idRol explícito enviado por la web', async () => {
    await service.create(
      {
        ...baseDto,
        idRol: WmsRol.operario,
        idBodega: '550e8400-e29b-41d4-a716-446655440000',
      },
      adminContext,
    );

    expect(configuradorUsuariosService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idRol: WmsRol.operario,
        idBodega: '550e8400-e29b-41d4-a716-446655440000',
      }),
      adminContext.idUsuario,
    );
  });

  it('rechaza crear usuario configurador', async () => {
    await expect(
      service.create({ ...baseDto, idRol: WmsRol.configurador }, adminContext),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza rol no permitido para administración', async () => {
    await expect(
      service.create({ ...baseDto, idRol: WmsRol.transportista }, adminContext),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza contexto tenant sin empresa o cuenta', async () => {
    await expect(
      service.create(baseDto, {
        ...adminContext,
        codigoEmpresa: null,
        codigoCuenta: null,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  const operadorCuenta = {
    idUsuario: 'usr-op',
    idAuth: 'auth-op',
    idRol: WmsRol.operador_cuenta,
    codigoCuenta: 'CTA001',
    estaActivo: true,
    nombre: 'Operador',
    username: 'OPER01',
    correo: 'operador@test.com',
    telefono: '+573001112233',
  };

  it('actualiza un operador de la misma cuenta', async () => {
    usuarioRepository.findById.mockResolvedValue(operadorCuenta as never);
    configuradorUsuariosService.update.mockResolvedValue({
      idUsuario: operadorCuenta.idUsuario,
      username: operadorCuenta.username,
      nombre: 'Operador Editado',
      idRol: WmsRol.operador_cuenta,
      codigoCuenta: 'CTA001',
      correo: 'nuevo@test.com',
      telefono: '+573009998877',
    });

    await service.update(
      operadorCuenta.idUsuario,
      { nombre: 'Operador Editado', correo: 'nuevo@test.com' },
      adminContext,
    );

    expect(configuradorUsuariosService.update).toHaveBeenCalledWith(
      operadorCuenta.idUsuario,
      { nombre: 'Operador Editado', correo: 'nuevo@test.com' },
    );
  });

  it('restablece la contraseña de un operador de la misma cuenta', async () => {
    usuarioRepository.findById.mockResolvedValue(operadorCuenta as never);
    configuradorUsuariosService.resetPassword.mockResolvedValue({
      idUsuario: operadorCuenta.idUsuario,
      username: operadorCuenta.username,
      nombre: operadorCuenta.nombre,
      idRol: WmsRol.operador_cuenta,
      codigoCuenta: 'CTA001',
      correo: operadorCuenta.correo,
      telefono: operadorCuenta.telefono,
    });

    await service.resetPassword(
      operadorCuenta.idUsuario,
      'ClaveNueva1!',
      adminContext,
    );

    expect(configuradorUsuariosService.resetPassword).toHaveBeenCalledWith(
      operadorCuenta.idUsuario,
      'ClaveNueva1!',
    );
  });

  it('no actualiza un usuario de otra cuenta', async () => {
    usuarioRepository.findById.mockResolvedValue({
      ...operadorCuenta,
      codigoCuenta: 'OTRA',
    } as never);

    await expect(
      service.update(operadorCuenta.idUsuario, { nombre: 'X' }, adminContext),
    ).rejects.toThrow(NotFoundException);
    expect(configuradorUsuariosService.update).not.toHaveBeenCalled();
  });
});
