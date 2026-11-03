import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import { CorreoDescartadoService } from '../services/correo-descartado.service';
import { CorreoDescartadoController } from './correo-descartado.controller';

const MSG = '1a1a198510cde156';

describe('CorreoDescartadoController — rutas y límites de peticiones (REQ-104)', () => {
  let app: INestApplication;
  const service = {
    listar: jest
      .fn()
      .mockResolvedValue({ total: 0, pagina: 1, tamano: 25, filas: [] }),
    ingresar: jest
      .fn()
      .mockResolvedValue({ messageId: MSG, estado: 'procesando' }),
    consultar: jest
      .fn()
      .mockResolvedValue({ messageId: MSG, estado: 'procesando' }),
  };

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
      controllers: [CorreoDescartadoController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: CorreoDescartadoService, useValue: service },
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
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('el sondeo del ingreso no se corta con el límite `auth` (cada 3 s = 20 por minuto)', async () => {
    const estados: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      const r = await request(app.getHttpServer()).get(
        `/ventas/correos/${MSG}/ingreso`,
      );
      estados.push(r.status);
    }
    expect(estados.every((s) => s === 200)).toBe(true);
  });

  it('ingresar responde 202 y delega el correo en el servicio', async () => {
    const r = await request(app.getHttpServer()).post(
      `/ventas/correos/${MSG}/ingresar`,
    );
    expect(r.status).toBe(202);
    expect(service.ingresar).toHaveBeenCalledWith(MSG, undefined);
  });

  it('listar aplica los valores por defecto y valida los filtros', async () => {
    const ok = await request(app.getHttpServer()).get(
      '/ventas/correos?modo=descartados&tamano=10',
    );
    expect(ok.status).toBe(200);
    expect(service.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ modo: 'descartados', pagina: 1, tamano: 10 }),
      undefined,
    );

    const malos = [
      '/ventas/correos?modo=otro',
      '/ventas/correos?tamano=500',
      '/ventas/correos?pagina=0',
      '/ventas/correos?desde=ayer',
    ];
    for (const ruta of malos) {
      const r = await request(app.getHttpServer()).get(ruta);
      expect(r.status).toBe(400);
    }
  });
});
