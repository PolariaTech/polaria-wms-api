import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { SupabaseAuthService } from '../src/core/auth/supabase-auth.service';
import { GlobalExceptionFilter } from '../src/core/filters/global-exception.filter';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { TenantGuard } from '../src/core/guards/tenant.guard';
import { TenantService } from '../src/core/tenant/tenant.service';
import { RolNivel, WmsRol } from '../src/generated/prisma/client';
import { ConversacionesController } from '../src/modules/mateo-widget/controllers/conversaciones.controller';
import { ConversacionesRepository } from '../src/modules/mateo-widget/infrastructure/conversaciones.repository';
import { ConversacionesService } from '../src/modules/mateo-widget/services/conversaciones.service';

describe('Mateo conversaciones auth (e2e)', () => {
  let app: INestApplication<App>;
  let supabaseAuth: { getUserFromToken: jest.Mock };
  let tenantService: { buildContext: jest.Mock };
  let conversacionesRepository: {
    listByUsuario: jest.Mock;
    findByIdForUsuario: jest.Mock;
  };

  const usuarioA = {
    idUsuario: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    idRol: WmsRol.operador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'ACME',
    codigoCuenta: 'ACME-01',
    codigosCuentaEmpresa: ['ACME-01'],
    idBodegas: [],
  };

  const convPropia = {
    idConversacion: 'f3000001-0001-4001-8001-000000000001',
    titulo: 'Mi chat',
    codigoCuenta: 'ACME-01',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    mensajes: [],
  };

  beforeEach(async () => {
    supabaseAuth = {
      getUserFromToken: jest.fn().mockResolvedValue({
        id: '33333333-3333-3333-3333-333333333333',
      }),
    };
    tenantService = {
      buildContext: jest.fn().mockResolvedValue(usuarioA),
    };
    conversacionesRepository = {
      listByUsuario: jest.fn().mockResolvedValue([convPropia]),
      findByIdForUsuario: jest.fn().mockResolvedValue(convPropia),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ConversacionesController],
      providers: [
        ConversacionesService,
        { provide: ConversacionesRepository, useValue: conversacionesRepository },
        { provide: SupabaseAuthService, useValue: supabaseAuth },
        { provide: TenantService, useValue: tenantService },
        JwtAuthGuard,
        TenantGuard,
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

  it('GET /mateo/conversaciones responde 401 sin Bearer', async () => {
    await request(app.getHttpServer()).get('/mateo/conversaciones').expect(401);
  });

  it('GET /mateo/conversaciones responde 401 con Bearer inválido', async () => {
    supabaseAuth.getUserFromToken.mockRejectedValue(
      new UnauthorizedException('Token inválido o expirado'),
    );

    await request(app.getHttpServer())
      .get('/mateo/conversaciones')
      .set('Authorization', 'Bearer token-manipulado')
      .expect(401);
  });

  it('GET /mateo/conversaciones lista solo conversaciones del usuario autenticado', async () => {
    const response = await request(app.getHttpServer())
      .get('/mateo/conversaciones')
      .set('Authorization', 'Bearer sesion-valida')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(conversacionesRepository.listByUsuario).toHaveBeenCalledWith(
      usuarioA.idUsuario,
    );
  });

  it('GET /mateo/conversaciones/:id responde 404 si no pertenece al usuario', async () => {
    conversacionesRepository.findByIdForUsuario.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/mateo/conversaciones/f3000001-0001-4001-8001-000000000099')
      .set('Authorization', 'Bearer sesion-valida')
      .expect(404);
  });
});
