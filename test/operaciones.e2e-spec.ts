import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { SupabaseAuthService } from '../src/core/auth/supabase-auth.service';
import { GlobalExceptionFilter } from '../src/core/filters/global-exception.filter';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { SensitiveWriteGuard } from '../src/core/guards/sensitive-write.guard';
import { TenantGuard } from '../src/core/guards/tenant.guard';
import { TenantService } from '../src/core/tenant/tenant.service';
import { RolNivel, WmsRol } from '../src/generated/prisma/client';
import {
  OperariosController,
  OrdenTrabajoController,
  PresenciaController,
} from '../src/modules/operations/controllers/operations.controller';
import { AlertaOperativaRepository } from '../src/modules/operations/infrastructure/alerta-operativa.repository';
import { OrdenTrabajoRepository } from '../src/modules/operations/infrastructure/orden-trabajo.repository';
import { OrdenTrabajoService } from '../src/modules/operations/services/operations.service';
import { OperariosService } from '../src/modules/operations/services/operarios.service';

describe('Operaciones operarios y asignación (e2e)', () => {
  let app: INestApplication<App>;
  let operariosService: {
    listDisponibles: jest.Mock;
    ping: jest.Mock;
    assertOperarioAsignable: jest.Mock;
  };
  let ordenService: { create: jest.Mock };
  let tenantService: { buildContext: jest.Mock };

  const bodegaId = '550e8400-e29b-41d4-a716-446655440000';
  const operarioId = '660e8400-e29b-41d4-a716-446655440001';

  const jefeContext = {
    idUsuario: 'jefe-1',
    idRol: WmsRol.jefe_bodega,
    nivelRol: RolNivel.bodega,
    codigoCuenta: 'CTA001',
    idBodegas: [bodegaId],
  };

  const operarioContext = {
    idUsuario: operarioId,
    idRol: WmsRol.operario,
    nivelRol: RolNivel.bodega,
    codigoCuenta: 'CTA001',
    idBodegas: [bodegaId],
  };

  beforeEach(async () => {
    operariosService = {
      listDisponibles: jest.fn().mockResolvedValue([
        {
          idUsuario: operarioId,
          nombre: 'María López',
          username: 'maria.lopez',
          tareasPendientes: 1,
          disponible: true,
          ultimoPing: '2026-07-09T16:20:00.000Z',
        },
      ]),
      ping: jest.fn().mockResolvedValue(undefined),
      assertOperarioAsignable: jest.fn().mockResolvedValue(undefined),
    };

    ordenService = {
      create: jest.fn().mockResolvedValue({
        idOrdenTrabajo: 'ot-1',
        codigo: 'OT-000001',
        idAsignado: operarioId,
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OperariosController, PresenciaController, OrdenTrabajoController],
      providers: [
        { provide: OperariosService, useValue: operariosService },
        { provide: OrdenTrabajoService, useValue: ordenService },
        { provide: AlertaOperativaRepository, useValue: {} },
        {
          provide: SupabaseAuthService,
          useValue: {
            getUserFromToken: jest.fn().mockResolvedValue({ id: 'auth-1' }),
          },
        },
        {
          provide: TenantService,
          useValue: {
            buildContext: jest.fn().mockResolvedValue(jefeContext),
          },
        },
        JwtAuthGuard,
        TenantGuard,
        RolesGuard,
        {
          provide: SensitiveWriteGuard,
          useValue: { canActivate: () => true },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    tenantService = moduleFixture.get(TenantService);
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

  it('GET /operaciones/operarios-disponibles responde 401 sin token', async () => {
    await request(app.getHttpServer())
      .get('/operaciones/operarios-disponibles')
      .query({ codigoCuenta: 'CTA001', idBodega: bodegaId })
      .expect(401);
  });

  it('GET /operaciones/operarios-disponibles responde 400 sin query', async () => {
    await request(app.getHttpServer())
      .get('/operaciones/operarios-disponibles')
      .set('Authorization', 'Bearer jefe-token')
      .expect(400);
  });

  it('GET /operaciones/operarios-disponibles responde 403 para operario', async () => {
    tenantService.buildContext.mockResolvedValue(operarioContext);

    await request(app.getHttpServer())
      .get('/operaciones/operarios-disponibles')
      .set('Authorization', 'Bearer operario-token')
      .query({ codigoCuenta: 'CTA001', idBodega: bodegaId })
      .expect(403);
  });

  it('GET /operaciones/operarios-disponibles responde 200 para jefe', async () => {
    const response = await request(app.getHttpServer())
      .get('/operaciones/operarios-disponibles')
      .set('Authorization', 'Bearer jefe-token')
      .query({ codigoCuenta: 'CTA001', idBodega: bodegaId })
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        idUsuario: operarioId,
        disponible: true,
        tareasPendientes: 1,
      }),
    ]);
  });

  it('POST /operaciones/presencia/ping responde 204 para operario', async () => {
    tenantService.buildContext.mockResolvedValue(operarioContext);

    await request(app.getHttpServer())
      .post('/operaciones/presencia/ping')
      .set('Authorization', 'Bearer operario-token')
      .send({ codigoCuenta: 'CTA001', idBodega: bodegaId })
      .expect(204);

    expect(operariosService.ping).toHaveBeenCalled();
  });

  it('POST /operaciones/ordenes-trabajo acepta idAsignado', async () => {
    await request(app.getHttpServer())
      .post('/operaciones/ordenes-trabajo')
      .set('Authorization', 'Bearer jefe-token')
      .send({
        codigoCuenta: 'CTA001',
        idBodega: bodegaId,
        tipoFlujo: 'revisar',
        idAsignado: operarioId,
      })
      .expect(201);

    expect(ordenService.create).toHaveBeenCalledWith(
      expect.objectContaining({ idAsignado: operarioId, tipoFlujo: 'revisar' }),
      expect.objectContaining({ idUsuario: 'jefe-1' }),
    );
  });
});
