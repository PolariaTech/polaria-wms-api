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
import { WarehouseStateController } from '../src/modules/inventory/controllers/warehouse-state.controller';
import { LOCK_STALE_MS } from '../src/modules/inventory/constants/inventory.constants';
import { WarehouseStateRepository } from '../src/modules/inventory/infrastructure/warehouse-state.repository';
import { WarehouseStateService } from '../src/modules/inventory/services/warehouse-state.service';

describe('Warehouse state lock (e2e)', () => {
  let app: INestApplication<App>;
  let repository: {
    findById: jest.Mock;
    lock: jest.Mock;
    unlock: jest.Mock;
    list: jest.Mock;
    toResponse: jest.Mock;
  };

  const idWs = '550e8400-e29b-41d4-a716-446655440500';
  const idBodega = '550e8400-e29b-41d4-a716-446655440000';
  const body = { codigoCuenta: 'ACME-01', idBodega };

  const operarioA = {
    idUsuario: 'operario-a',
    idRol: WmsRol.operario,
    nivelRol: RolNivel.bodega,
    codigoEmpresa: 'ACME',
    codigoCuenta: 'ACME-01',
    codigosCuentaEmpresa: ['ACME-01'],
    idBodegas: [idBodega],
  };

  const operarioB = {
    ...operarioA,
    idUsuario: 'operario-b',
  };

  const baseRow = {
    idWarehouseState: idWs,
    codigoCuenta: 'ACME-01',
    idBodega,
    idUbicacion: '550e8400-e29b-41d4-a716-446655440099',
    idProducto: '550e8400-e29b-41d4-a716-446655440010',
    idLote: null,
    cantidad: { toString: () => '10' },
    cantidadReservada: { toString: () => '0' },
    temperatura: null,
    lockedBy: null,
    lockedAt: null,
    version: 1,
    updatedAt: new Date(),
  };

  let currentContext = operarioA;

  beforeEach(async () => {
    currentContext = operarioA;

    repository = {
      findById: jest.fn(),
      lock: jest.fn(),
      unlock: jest.fn(),
      list: jest.fn().mockResolvedValue([]),
      toResponse: jest.fn((row) => ({
        idWarehouseState: row.idWarehouseState,
        codigoCuenta: row.codigoCuenta,
        idBodega: row.idBodega,
        idUbicacion: row.idUbicacion,
        idProducto: row.idProducto,
        idLote: row.idLote,
        cantidad: row.cantidad.toString(),
        cantidadReservada: row.cantidadReservada.toString(),
        temperatura: row.temperatura?.toString() ?? null,
        lockedBy: row.lockedBy,
        lockedAt: row.lockedAt,
        version: row.version,
        updatedAt: row.updatedAt,
      })),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [WarehouseStateController],
      providers: [
        WarehouseStateService,
        { provide: WarehouseStateRepository, useValue: repository },
        {
          provide: SupabaseAuthService,
          useValue: {
            getUserFromToken: jest.fn().mockResolvedValue({ id: 'auth-1' }),
          },
        },
        {
          provide: TenantService,
          useValue: {
            buildContext: jest.fn().mockImplementation(() =>
              Promise.resolve(currentContext),
            ),
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

  it('permite lock en posición libre', async () => {
    repository.findById.mockResolvedValue(baseRow);
    repository.lock.mockResolvedValue({
      ...baseRow,
      lockedBy: operarioA.idUsuario,
      lockedAt: new Date(),
      version: 2,
    });

    const response = await request(app.getHttpServer())
      .post(`/inventario/warehouse-state/${idWs}/lock`)
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(200);

    expect(response.body.lockedBy).toBe(operarioA.idUsuario);
  });

  it('rechaza 409 cuando otro operario tiene lock activo', async () => {
    currentContext = operarioB;
    repository.findById.mockResolvedValue({
      ...baseRow,
      lockedBy: operarioA.idUsuario,
      lockedAt: new Date(),
    });

    await request(app.getHttpServer())
      .post(`/inventario/warehouse-state/${idWs}/lock`)
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(409);
  });

  it('permite takeover tras lock stale', async () => {
    currentContext = operarioB;
    repository.findById.mockResolvedValue({
      ...baseRow,
      lockedBy: operarioA.idUsuario,
      lockedAt: new Date(Date.now() - LOCK_STALE_MS - 1_000),
    });
    repository.lock.mockResolvedValue({
      ...baseRow,
      lockedBy: operarioB.idUsuario,
      lockedAt: new Date(),
      version: 3,
    });

    const response = await request(app.getHttpServer())
      .post(`/inventario/warehouse-state/${idWs}/lock`)
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(200);

    expect(response.body.lockedBy).toBe(operarioB.idUsuario);
    expect(repository.lock).toHaveBeenCalledWith(
      idWs,
      operarioB.idUsuario,
      undefined,
      true,
    );
  });

  it('libera lock del titular y permite lock del segundo operario', async () => {
    repository.findById.mockResolvedValue({
      ...baseRow,
      lockedBy: operarioA.idUsuario,
      lockedAt: new Date(),
    });
    repository.unlock.mockResolvedValue({
      ...baseRow,
      lockedBy: null,
      lockedAt: null,
      version: 2,
    });

    await request(app.getHttpServer())
      .post(`/inventario/warehouse-state/${idWs}/unlock`)
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(200);

    currentContext = operarioB;
    repository.findById.mockResolvedValue({
      ...baseRow,
      lockedBy: null,
      lockedAt: null,
      version: 2,
    });
    repository.lock.mockResolvedValue({
      ...baseRow,
      lockedBy: operarioB.idUsuario,
      lockedAt: new Date(),
      version: 3,
    });

    const response = await request(app.getHttpServer())
      .post(`/inventario/warehouse-state/${idWs}/lock`)
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(200);

    expect(response.body.lockedBy).toBe(operarioB.idUsuario);
  });
});
