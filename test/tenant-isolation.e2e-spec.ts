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
import { OrdenTrabajoController } from '../src/modules/operations/controllers/operations.controller';
import { AlertaOperativaRepository } from '../src/modules/operations/infrastructure/alerta-operativa.repository';
import { OrdenTrabajoRepository } from '../src/modules/operations/infrastructure/orden-trabajo.repository';
import { OperariosService } from '../src/modules/operations/services/operarios.service';
import { OrdenTrabajoService } from '../src/modules/operations/services/operations.service';

describe('Tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let tenantService: { buildContext: jest.Mock };

  const bodegaId = '550e8400-e29b-41d4-a716-446655440000';

  const jefeAcme01 = {
    idUsuario: 'jefe-1',
    idRol: WmsRol.jefe_bodega,
    nivelRol: RolNivel.bodega,
    codigoEmpresa: 'ACME',
    codigoCuenta: 'ACME-01',
    codigosCuentaEmpresa: ['ACME-01'],
    idBodegas: [bodegaId],
  };

  const adminEmpresaAcme = {
    idUsuario: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    idRol: WmsRol.administrador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'ACME',
    codigoCuenta: null,
    codigosCuentaEmpresa: ['ACME-01', 'ACME-02'],
    idBodegas: [],
  };

  beforeEach(async () => {
    const ordenTrabajoRepository = {
      list: jest.fn().mockResolvedValue([]),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OrdenTrabajoController],
      providers: [
        OrdenTrabajoService,
        { provide: OrdenTrabajoRepository, useValue: ordenTrabajoRepository },
        {
          provide: OperariosService,
          useValue: { assertOperarioAsignable: jest.fn() },
        },
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
            buildContext: jest.fn().mockResolvedValue(jefeAcme01),
          },
        },
        JwtAuthGuard,
        TenantGuard,
        RolesGuard,
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

  it('rechaza 403 cuando jefe consulta cuenta ajena (BETA-01)', async () => {
    await request(app.getHttpServer())
      .get('/operaciones/ordenes-trabajo')
      .query({ codigoCuenta: 'BETA-01', idBodega: bodegaId })
      .set('Authorization', 'Bearer token')
      .expect(403);
  });

  it('permite consulta cuando cuenta pertenece al contexto del jefe', async () => {
    await request(app.getHttpServer())
      .get('/operaciones/ordenes-trabajo')
      .query({ codigoCuenta: 'ACME-01', idBodega: bodegaId })
      .set('Authorization', 'Bearer token')
      .expect(200);
  });

  it('rechaza 403 cuando admin empresa consulta cuenta BETA', async () => {
    tenantService.buildContext.mockResolvedValue(adminEmpresaAcme);

    await request(app.getHttpServer())
      .get('/operaciones/ordenes-trabajo')
      .query({ codigoCuenta: 'BETA-01', idBodega: bodegaId })
      .set('Authorization', 'Bearer token')
      .expect(403);
  });

  it('permite admin empresa en cuenta ACME-02 de su tenant', async () => {
    tenantService.buildContext.mockResolvedValue(adminEmpresaAcme);

    await request(app.getHttpServer())
      .get('/operaciones/ordenes-trabajo')
      .query({ codigoCuenta: 'ACME-02', idBodega: bodegaId })
      .set('Authorization', 'Bearer token')
      .expect(200);
  });
});
