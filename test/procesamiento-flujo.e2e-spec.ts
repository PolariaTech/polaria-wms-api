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
import { EstadoProcesamiento, RolNivel, WmsRol } from '../src/generated/prisma/client';
import { TareaColaController } from '../src/modules/operations/controllers/operations.controller';
import { TareaColaService } from '../src/modules/operations/services/operations.service';
import { SolicitudProcesamientoController } from '../src/modules/processing/controllers/solicitud-procesamiento.controller';
import { SolicitudProcesamientoRepository } from '../src/modules/processing/infrastructure/solicitud-procesamiento.repository';
import { SolicitudProcesamientoService } from '../src/modules/processing/services/solicitud-procesamiento.service';

describe('Procesamiento flujo frio (e2e)', () => {
  let app: INestApplication<App>;
  let service: {
    create: jest.Mock;
    asignarOperario: jest.Mock;
    iniciar: jest.Mock;
  };
  let tareaService: { completar: jest.Mock };
  let tenantService: { buildContext: jest.Mock };

  const bodegaId = '550e8400-e29b-41d4-a716-446655440000';
  const operarioId = '660e8400-e29b-41d4-a716-446655440001';
  const solicitudId = '770e8400-e29b-41d4-a716-446655440002';
  const tareaId = '880e8400-e29b-41d4-a716-446655440003';

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

  const solicitudResponse = {
    idSolicitudProcesamiento: solicitudId,
    codigoCuenta: 'CTA001',
    idBodega: bodegaId,
    codigo: 'PROC-000001',
    estado: EstadoProcesamiento.pendiente,
    idOperario: null,
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(solicitudResponse),
      asignarOperario: jest.fn().mockResolvedValue({
        ...solicitudResponse,
        idOperario: operarioId,
      }),
      iniciar: jest.fn().mockResolvedValue({
        ...solicitudResponse,
        idOperario: operarioId,
        estado: EstadoProcesamiento.en_proceso,
      }),
    };

    tareaService = {
      completar: jest.fn().mockResolvedValue({
        idTarea: tareaId,
        estado: 'completada',
        idSolicitudProcesamiento: solicitudId,
      }),
    };

    tenantService = {
      buildContext: jest.fn().mockResolvedValue(jefeContext),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SolicitudProcesamientoController, TareaColaController],
      providers: [
        { provide: SolicitudProcesamientoService, useValue: service },
        { provide: SolicitudProcesamientoRepository, useValue: {} },
        { provide: TareaColaService, useValue: tareaService },
        {
          provide: SupabaseAuthService,
          useValue: {
            getUserFromToken: jest.fn().mockResolvedValue({ id: 'auth-1' }),
          },
        },
        { provide: TenantService, useValue: tenantService },
        JwtAuthGuard,
        TenantGuard,
        RolesGuard,
        { provide: SensitiveWriteGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('operador crea → jefe asigna → operario inicia → completa tarea', async () => {
    await request(app.getHttpServer())
      .post('/procesamiento/solicitudes')
      .set('Authorization', 'Bearer token')
      .send({
        codigoCuenta: 'CTA001',
        idBodega: bodegaId,
        idProductoPrimario: 'prod-1',
        idProductoSecundario: 'prod-2',
        kilosPrimario: 100,
      })
      .expect(201);

    expect(service.create).toHaveBeenCalled();

    await request(app.getHttpServer())
      .patch(`/procesamiento/solicitudes/${solicitudId}/asignar-operario`)
      .set('Authorization', 'Bearer token')
      .send({
        codigoCuenta: 'CTA001',
        idBodega: bodegaId,
        idOperario: operarioId,
      })
      .expect(200);

    expect(service.asignarOperario).toHaveBeenCalledWith(
      solicitudId,
      expect.objectContaining({ idOperario: operarioId }),
      jefeContext,
    );

    tenantService.buildContext.mockResolvedValue(operarioContext);

    await request(app.getHttpServer())
      .post(`/procesamiento/solicitudes/${solicitudId}/iniciar`)
      .set('Authorization', 'Bearer token')
      .send({
        codigoCuenta: 'CTA001',
        idBodega: bodegaId,
      })
      .expect(200);

    expect(service.iniciar).toHaveBeenCalled();

    await request(app.getHttpServer())
      .post(`/operaciones/tareas/${tareaId}/completar`)
      .set('Authorization', 'Bearer token')
      .send({
        codigoCuenta: 'CTA001',
        idBodega: bodegaId,
      })
      .expect(201);

    expect(tareaService.completar).toHaveBeenCalledWith(
      tareaId,
      { codigoCuenta: 'CTA001', idBodega: bodegaId },
      operarioContext,
    );
  });
});
