import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { SupabaseAuthService } from '../src/core/auth/supabase-auth.service';
import { GlobalExceptionFilter } from '../src/core/filters/global-exception.filter';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { TenantGuard } from '../src/core/guards/tenant.guard';
import { TenantService } from '../src/core/tenant/tenant.service';
import { RolNivel, WmsRol } from '../src/generated/prisma/client';
import { AdministracionUsuariosController } from '../src/modules/configurator/controllers/administracion-usuarios.controller';
import { ConfiguradorUsuarioRepository } from '../src/modules/configurator/infrastructure/configurador-usuario.repository';
import { AdministracionUsuariosService } from '../src/modules/configurator/services/administracion-usuarios.service';
import { ConfiguradorUsuariosService } from '../src/modules/configurator/services/configurador-usuarios.service';

describe('AdministracionUsuariosController (e2e)', () => {
  let app: INestApplication<App>;
  let configuradorUsuariosService: {
    create: jest.Mock;
    update: jest.Mock;
    resetPassword: jest.Mock;
  };
  let usuarioRepository: { findById: jest.Mock };

  const adminContext = {
    idUsuario: 'usr-admin',
    idRol: WmsRol.administrador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    idBodegas: [],
  };

  const operadorContext = {
    idUsuario: 'usr-operador',
    idRol: WmsRol.operador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    idBodegas: [],
  };

  beforeEach(async () => {
    configuradorUsuariosService = {
      create: jest.fn(),
      update: jest.fn(),
      resetPassword: jest.fn(),
    };
    usuarioRepository = { findById: jest.fn() };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdministracionUsuariosController],
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
        {
          provide: SupabaseAuthService,
          useValue: {
            getUserFromToken: jest.fn().mockResolvedValue({ id: 'auth-admin' }),
          },
        },
        {
          provide: TenantService,
          useValue: {
            buildContext: jest.fn().mockResolvedValue(adminContext),
          },
        },
        JwtAuthGuard,
        TenantGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /administracion/usuarios responde 401 sin token', async () => {
    await request(app.getHttpServer())
      .post('/administracion/usuarios')
      .send({
        username: 'nuevo',
        nombre: 'Nuevo',
        idRol: WmsRol.operario,
        idBodega: '550e8400-e29b-41d4-a716-446655440000',
        correo: 'nuevo@test.com',
        password: 'secret12',
      })
      .expect(401);
  });

  it('POST /administracion/usuarios responde 403 para operador sin permiso', async () => {
    const tenantService = app.get(TenantService);
    (tenantService.buildContext as jest.Mock).mockResolvedValue(
      operadorContext,
    );

    await request(app.getHttpServer())
      .post('/administracion/usuarios')
      .set('Authorization', 'Bearer operador-token')
      .send({
        username: 'nuevo',
        nombre: 'Nuevo',
        idRol: WmsRol.operario,
        idBodega: '550e8400-e29b-41d4-a716-446655440000',
        correo: 'nuevo@test.com',
        password: 'secret12',
      })
      .expect(403);
  });

  it('POST /administracion/usuarios responde 400 con body inválido', async () => {
    await request(app.getHttpServer())
      .post('/administracion/usuarios')
      .set('Authorization', 'Bearer admin-token')
      .send({ username: 'x' })
      .expect(400);
  });

  it('POST /administracion/usuarios responde 201 sin idRol (default operador_cuenta)', async () => {
    configuradorUsuariosService.create.mockResolvedValue({
      idUsuario: 'usr-new',
      username: 'operador.c1',
      nombre: 'Operador',
      idRol: WmsRol.operador_cuenta,
      codigoCuenta: 'CTA001',
      correo: 'operador@test.com',
    });

    await request(app.getHttpServer())
      .post('/administracion/usuarios')
      .set('Authorization', 'Bearer admin-token')
      .send({
        username: 'operador.c1',
        nombre: 'Operador',
        correo: 'operador@test.com',
        password: 'secret12',
      })
      .expect(201);

    expect(configuradorUsuariosService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idRol: WmsRol.operador_cuenta,
        codigoEmpresa: 'EMP001',
        codigoCuenta: 'CTA001',
      }),
      adminContext.idUsuario,
    );
  });

  it('POST /administracion/usuarios responde 201 con idRol explícito', async () => {
    configuradorUsuariosService.create.mockResolvedValue({
      idUsuario: 'usr-new',
      username: 'operario.b1',
      nombre: 'Operario',
      idRol: WmsRol.operario,
      codigoCuenta: 'CTA001',
      correo: 'operario@test.com',
    });

    await request(app.getHttpServer())
      .post('/administracion/usuarios')
      .set('Authorization', 'Bearer admin-token')
      .send({
        username: 'operario.b1',
        nombre: 'Operario',
        idRol: WmsRol.operario,
        idBodega: '550e8400-e29b-41d4-a716-446655440000',
        correo: 'operario@test.com',
        password: 'secret12',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.idUsuario).toBe('usr-new');
        expect(res.body.codigoCuenta).toBe('CTA001');
      });

    expect(configuradorUsuariosService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'operario.b1',
        idRol: WmsRol.operario,
        idBodega: '550e8400-e29b-41d4-a716-446655440000',
      }),
      adminContext.idUsuario,
    );
  });

  const idUsuario = '550e8400-e29b-41d4-a716-446655440099';

  it('PATCH /administracion/usuarios/:idUsuario actualiza datos sin username', async () => {
    usuarioRepository.findById.mockResolvedValue({
      idUsuario,
      idRol: WmsRol.operador_cuenta,
      codigoCuenta: 'CTA001',
      estaActivo: true,
    });
    configuradorUsuariosService.update.mockResolvedValue({
      idUsuario,
      username: 'OPER01',
      nombre: 'Operador Editado',
      idRol: WmsRol.operador_cuenta,
      codigoCuenta: 'CTA001',
      correo: 'nuevo@test.com',
      telefono: '+573001112233',
    });

    await request(app.getHttpServer())
      .patch(`/administracion/usuarios/${idUsuario}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        nombre: 'Operador Editado',
        correo: 'nuevo@test.com',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.nombre).toBe('Operador Editado');
        expect(res.body.username).toBe('OPER01');
      });

    expect(configuradorUsuariosService.update).toHaveBeenCalledWith(
      idUsuario,
      expect.objectContaining({
        nombre: 'Operador Editado',
        correo: 'nuevo@test.com',
      }),
    );
  });

  it('POST /administracion/usuarios/:idUsuario/password restablece la clave', async () => {
    usuarioRepository.findById.mockResolvedValue({
      idUsuario,
      idRol: WmsRol.operador_cuenta,
      codigoCuenta: 'CTA001',
      estaActivo: true,
    });
    configuradorUsuariosService.resetPassword.mockResolvedValue({
      idUsuario,
      username: 'OPER01',
      nombre: 'Operador',
      idRol: WmsRol.operador_cuenta,
      codigoCuenta: 'CTA001',
      correo: 'operador@test.com',
      telefono: null,
    });

    await request(app.getHttpServer())
      .post(`/administracion/usuarios/${idUsuario}/password`)
      .set('Authorization', 'Bearer admin-token')
      .send({ password: 'ClaveNueva1!' })
      .expect(200);

    expect(configuradorUsuariosService.resetPassword).toHaveBeenCalledWith(
      idUsuario,
      'ClaveNueva1!',
    );
  });

  it('POST /administracion/usuarios/:idUsuario/password responde 403 para operador', async () => {
    const tenantService = app.get(TenantService);
    (tenantService.buildContext as jest.Mock).mockResolvedValue(
      operadorContext,
    );

    await request(app.getHttpServer())
      .post(`/administracion/usuarios/${idUsuario}/password`)
      .set('Authorization', 'Bearer operador-token')
      .send({ password: 'ClaveNueva1!' })
      .expect(403);
  });
});
