import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import { AdministracionUsuariosService } from './administracion-usuarios.service';
import { ConfiguradorUsuariosService } from './configurador-usuarios.service';

describe('AdministracionUsuariosService', () => {
  let service: AdministracionUsuariosService;
  let configuradorUsuariosService: jest.Mocked<
    Pick<ConfiguradorUsuariosService, 'create'>
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
    password: 'secret1',
  };

  beforeEach(async () => {
    configuradorUsuariosService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministracionUsuariosService,
        {
          provide: ConfiguradorUsuariosService,
          useValue: configuradorUsuariosService,
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
    });
  });

  it('usa operador_cuenta por defecto cuando idRol no se envía', async () => {
    await service.create(baseDto, adminContext);

    expect(configuradorUsuariosService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idRol: WmsRol.operador_cuenta,
        codigoEmpresa: 'EMP001',
        codigoCuenta: 'CTA001',
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
});
