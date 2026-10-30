import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import { OrdenCorreoRelecturaService } from '../services/orden-correo-relectura.service';
import { OrdenCorreoRelecturaController } from './orden-correo-relectura.controller';

const ID_OV = '11111111-1111-4111-8111-111111111111';
const ID_TRABAJO = '22222222-2222-4222-8222-222222222222';
const RUTA_CONSULTA = `/ventas/ordenes/${ID_OV}/ordenes-trabajo/propuesta-correccion-correo/${ID_TRABAJO}`;

describe('OrdenCorreoRelecturaController — límites de peticiones (REQ-187)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const pasa = { canActivate: () => true };
    const modulo = await Test.createTestingModule({
      imports: [
        // Misma configuración global que SecurityModule: dos límites con nombre.
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'default', ttl: 60_000, limit: 200 },
            { name: 'auth', ttl: 60_000, limit: 15 },
          ],
        }),
      ],
      controllers: [OrdenCorreoRelecturaController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        {
          provide: OrdenCorreoRelecturaService,
          useValue: {
            consultar: jest.fn().mockResolvedValue({ estado: 'procesando' }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(pasa)
      .overrideGuard(TenantGuard)
      .useValue(pasa)
      .overrideGuard(RolesGuard)
      .useValue(pasa)
      .compile();

    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('la consulta del trabajo no se corta con el límite `auth` (sondeo cada 3 s = 20 por minuto)', async () => {
    const estados: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      const respuesta = await request(app.getHttpServer()).get(RUTA_CONSULTA);
      estados.push(respuesta.status);
    }

    expect(estados.filter((estado) => estado === 429)).toHaveLength(0);
    expect(estados.every((estado) => estado === 200)).toBe(true);
  });
});
