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
import { EstadoTarea, RolNivel, WmsRol } from '../src/generated/prisma/client';
import { TareaColaController } from '../src/modules/operations/controllers/operations.controller';
import { TareaColaService } from '../src/modules/operations/services/operations.service';

describe('Operaciones completar tarea (e2e)', () => {
  let app: INestApplication<App>;
  let tareaService: { completar: jest.Mock };

  const bodegaId = '550e8400-e29b-41d4-a716-446655440000';
  const tareaId = 'e658ef49-5fb0-47f4-a85b-be0d21c6d556';

  const operarioContext = {
    idUsuario: 'operario-1',
    idRol: WmsRol.operario,
    nivelRol: RolNivel.bodega,
    codigoCuenta: 'CTA001',
    idBodegas: [bodegaId],
  };

  beforeEach(async () => {
    tareaService = {
      completar: jest.fn().mockResolvedValue({
        idTarea: tareaId,
        codigoCuenta: 'CTA001',
        idBodega: bodegaId,
        tipo: 'movimiento',
        estado: EstadoTarea.completada,
        idAsignado: 'operario-1',
        idOrdenTrabajo: 'ot-1',
        titulo: 'A bodega · OT-000001',
        descripcion: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TareaColaController],
      providers: [
        { provide: TareaColaService, useValue: tareaService },
        {
          provide: SupabaseAuthService,
          useValue: {
            getUserFromToken: jest.fn().mockResolvedValue({ id: 'auth-1' }),
          },
        },
        {
          provide: TenantService,
          useValue: {
            buildContext: jest.fn().mockResolvedValue(operarioContext),
          },
        },
        JwtAuthGuard,
        TenantGuard,
        RolesGuard,
        SensitiveWriteGuard,
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

  it('POST /operaciones/tareas/:id/completar responde 200 para operario', async () => {
    const response = await request(app.getHttpServer())
      .post(`/operaciones/tareas/${tareaId}/completar`)
      .set('Authorization', 'Bearer operario-token')
      .send({ codigoCuenta: 'CTA001', idBodega: bodegaId })
      .expect(200);

    expect(response.body.estado).toBe(EstadoTarea.completada);
    expect(tareaService.completar).toHaveBeenCalledWith(
      tareaId,
      { codigoCuenta: 'CTA001', idBodega: bodegaId },
      expect.objectContaining({ idUsuario: 'operario-1' }),
    );
  });

  it('POST /operaciones/tareas/:id/completar responde 401 sin token', async () => {
    await request(app.getHttpServer())
      .post(`/operaciones/tareas/${tareaId}/completar`)
      .send({ codigoCuenta: 'CTA001', idBodega: bodegaId })
      .expect(401);
  });
});
