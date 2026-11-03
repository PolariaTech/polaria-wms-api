import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import { CorreoDescartadoService } from '../services/correo-descartado.service';
import {
  CorreoDescartadoController,
  disposicionDeAdjunto,
} from './correo-descartado.controller';

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
    contenido: jest.fn().mockResolvedValue({
      asunto: 'Pedido',
      de: 'a@x.example',
      para: 'b@x.example',
      fecha: null,
      texto: 'hola',
      html: '<p>hola</p>',
      adjuntos: [
        { indice: 0, nombre: 'a.txt', mimeType: 'text/plain', tamano: 4 },
      ],
    }),
    adjunto: jest.fn().mockResolvedValue({
      nombre: 'Pedido ñandú.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hola'),
    }),
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
    for (let intento = 0; intento < 30; intento += 1) {
      const respuesta = await request(app.getHttpServer()).get(
        `/ventas/correos/${MSG}/ingreso`,
      );
      estados.push(respuesta.status);
    }
    expect(estados.every((codigo) => codigo === 200)).toBe(true);
  });

  it('ingresar responde 202 y delega el correo en el servicio', async () => {
    const respuesta = await request(app.getHttpServer()).post(
      `/ventas/correos/${MSG}/ingresar`,
    );
    expect(respuesta.status).toBe(202);
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
      const respuesta = await request(app.getHttpServer()).get(ruta);
      expect(respuesta.status).toBe(400);
    }
  });

  it('contenido devuelve el correo y delega en el servicio', async () => {
    const respuesta = await request(app.getHttpServer()).get(
      `/ventas/correos/${MSG}/contenido`,
    );
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      asunto: 'Pedido',
      html: '<p>hola</p>',
    });
    expect(service.contenido).toHaveBeenCalledWith(MSG, undefined);
  });

  it('el adjunto se descarga siempre como archivo, sin que el navegador lo interprete', async () => {
    const respuesta = await request(app.getHttpServer()).get(
      `/ventas/correos/${MSG}/adjuntos/0`,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toBe('hola');
    expect(respuesta.headers['content-type']).toContain('text/plain');
    expect(respuesta.headers['content-disposition']).toMatch(/^attachment;/);
    expect(respuesta.headers['content-disposition']).toContain(
      "filename*=UTF-8''Pedido%20%C3%B1and%C3%BA.txt",
    );
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['cache-control']).toContain('no-store');
    expect(service.adjunto).toHaveBeenCalledWith(MSG, 0, undefined);
  });

  it('un tipo de archivo raro se baja como binario genérico', async () => {
    service.adjunto.mockResolvedValueOnce({
      nombre: 'x.bin',
      mimeType: 'text/html; <script>',
      buffer: Buffer.from('x'),
    });
    const respuesta = await request(app.getHttpServer()).get(
      `/ventas/correos/${MSG}/adjuntos/1`,
    );
    expect(respuesta.headers['content-type']).toContain(
      'application/octet-stream',
    );
  });

  it('una posición de adjunto que no es un número responde 400', async () => {
    const respuesta = await request(app.getHttpServer()).get(
      `/ventas/correos/${MSG}/adjuntos/abc`,
    );
    expect(respuesta.status).toBe(400);
  });

  it('leer correos no se corta con el límite global `auth` (15 por minuto)', async () => {
    const estados: number[] = [];
    for (let intento = 0; intento < 20; intento += 1) {
      const respuesta = await request(app.getHttpServer()).get(
        `/ventas/correos/${MSG}/contenido`,
      );
      estados.push(respuesta.status);
    }
    expect(estados.every((codigo) => codigo === 200)).toBe(true);
  });

  it('bajar adjuntos sí tiene su propio límite (30 por minuto)', async () => {
    const estados: number[] = [];
    for (let intento = 0; intento < 40; intento += 1) {
      const respuesta = await request(app.getHttpServer()).get(
        `/ventas/correos/${MSG}/adjuntos/0`,
      );
      estados.push(respuesta.status);
    }
    expect(
      estados.filter((codigo) => codigo === 200).length,
    ).toBeLessThanOrEqual(30);
    expect(estados).toContain(429);
  });
});

describe('disposicionDeAdjunto', () => {
  it('siempre es attachment y conserva el nombre con acentos', () => {
    const disposicion = disposicionDeAdjunto('Lista de precios ñandú.xlsx');
    expect(disposicion).toMatch(/^attachment; /);
    expect(disposicion).toContain('filename="Lista de precios _and_.xlsx"');
    expect(disposicion).toContain(
      "filename*=UTF-8''Lista%20de%20precios%20%C3%B1and%C3%BA.xlsx",
    );
  });

  it('quita saltos de línea y comillas para no inyectar cabeceras', () => {
    const disposicion = disposicionDeAdjunto('a"\r\nSet-Cookie: x=1.pdf');
    expect(disposicion).not.toMatch(/[\r\n]/);
    expect(disposicion).not.toContain('a"');
    expect(disposicion.startsWith('attachment; filename="')).toBe(true);
  });

  it('codifica los apóstrofos y paréntesis, y no deja el nombre vacío', () => {
    expect(disposicionDeAdjunto("o'brien (1).pdf")).toContain(
      "filename*=UTF-8''o%27brien%20%281%29.pdf",
    );
    expect(disposicionDeAdjunto('  ')).toContain('filename="adjunto"');
  });
});
