import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
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

  const usuarioAAuth = '33333333-3333-3333-3333-333333333333';
  const usuarioBAuth = '66666666-6666-6666-6666-666666666666';

  const usuarioA = {
    idUsuario: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    idRol: WmsRol.operador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'ACME',
    codigoCuenta: 'ACME-01',
    codigosCuentaEmpresa: ['ACME-01'],
    idBodegas: [],
  } as const;

  const usuarioB = {
    idUsuario: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    idRol: WmsRol.administrador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'BETA',
    codigoCuenta: 'BETA-01',
    codigosCuentaEmpresa: ['BETA-01'],
    idBodegas: [],
  } as const;

  let counter = 1;
  const nextConversationId = () => {
    const suffix = String(counter++).padStart(12, '0');
    return `f3000001-0001-4001-8001-${suffix}`;
  };

  type RepoConv = {
    idConversacion: string;
    idUsuario: string;
    codigoCuenta: string | null;
    titulo: string | null;
    createdAt: Date;
    updatedAt: Date;
    mensajes: Array<{
      idMensaje: string;
      rol: 'user' | 'ai';
      tipo: 'text' | 'image';
      contenido: string;
      esError: boolean;
      createdAt: Date;
    }>;
  };

  const store = new Map<string, RepoConv>();

  const conversacionesRepository = {
    listByUsuario: jest.fn((idUsuario: string) => {
      return Array.from(store.values())
        .filter((c) => c.idUsuario === idUsuario)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map((c) => ({
          idConversacion: c.idConversacion,
          titulo: c.titulo,
          codigoCuenta: c.codigoCuenta,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }));
    }),
    findByIdForUsuario: jest.fn((idConversacion: string, idUsuario: string) => {
      const conv = store.get(idConversacion);
      if (!conv || conv.idUsuario !== idUsuario) return null;
      return {
        idConversacion: conv.idConversacion,
        titulo: conv.titulo,
        codigoCuenta: conv.codigoCuenta,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        mensajes: [...conv.mensajes],
      };
    }),
    create: jest.fn(
      (data: {
        idUsuario: string;
        codigoCuenta: string | null;
        titulo?: string | null;
      }) => {
        const now = new Date();
        const conv: RepoConv = {
          idConversacion: nextConversationId(),
          idUsuario: data.idUsuario,
          codigoCuenta: data.codigoCuenta,
          titulo: data.titulo?.trim() || null,
          createdAt: now,
          updatedAt: now,
          mensajes: [],
        };
        store.set(conv.idConversacion, conv);
        return {
          idConversacion: conv.idConversacion,
          titulo: conv.titulo,
          codigoCuenta: conv.codigoCuenta,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        };
      },
    ),
    appendMensaje: jest.fn(
      (params: {
        idConversacion: string;
        idUsuario: string;
        rol: 'user' | 'ai';
        tipo: 'text' | 'image';
        contenido: string;
        esError: boolean;
        createdAt?: Date;
      }) => {
        const conv = store.get(params.idConversacion);
        if (!conv || conv.idUsuario !== params.idUsuario) return null;

        const ts = params.createdAt ?? new Date();
        const duplicate = conv.mensajes.find(
          (m) =>
            m.rol === params.rol &&
            m.tipo === params.tipo &&
            m.contenido === params.contenido &&
            m.esError === params.esError &&
            m.createdAt.getTime() === ts.getTime(),
        );

        if (duplicate) {
          conv.updatedAt = new Date();
          return duplicate;
        }

        const idMensaje = `f3000001-0001-4001-8002-${String(conv.mensajes.length + 1).padStart(12, '0')}`;
        const nuevo = {
          idMensaje,
          rol: params.rol,
          tipo: params.tipo,
          contenido: params.contenido,
          esError: params.esError,
          createdAt: ts,
        };
        conv.mensajes.push(nuevo);
        conv.updatedAt = new Date();
        return nuevo;
      },
    ),
    deleteForUsuario: jest.fn((idConversacion: string, idUsuario: string) => {
      const conv = store.get(idConversacion);
      if (!conv || conv.idUsuario !== idUsuario) return false;
      store.delete(idConversacion);
      return true;
    }),
  };

  beforeEach(async () => {
    store.clear();
    counter = 1;
    supabaseAuth = {
      getUserFromToken: jest.fn().mockImplementation((token: string) => {
        if (token === 'token-usuario-a') return { id: usuarioAAuth };
        if (token === 'token-usuario-b') return { id: usuarioBAuth };
        throw new UnauthorizedException('Token inválido o expirado');
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ConversacionesController],
      providers: [
        ConversacionesService,
        {
          provide: ConversacionesRepository,
          useValue: conversacionesRepository,
        },
        { provide: SupabaseAuthService, useValue: supabaseAuth },
        {
          provide: TenantService,
          useValue: {
            buildContext: jest.fn().mockImplementation((idAuth: string) => {
              if (idAuth === usuarioAAuth) return usuarioA;
              if (idAuth === usuarioBAuth) return usuarioB;
              throw new UnauthorizedException('Token inválido o expirado');
            }),
          },
        },
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
    await request(app.getHttpServer())
      .get('/mateo/conversaciones')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('aisla historial entre usuario/empresa A y B', async () => {
    const created = await request(app.getHttpServer())
      .post('/mateo/conversaciones')
      .set('Authorization', 'Bearer token-usuario-a')
      .send({ titulo: 'Soporte ACME' })
      .expect(201);
    const conversationId = created.body.idConversacion as string;

    await request(app.getHttpServer())
      .post(`/mateo/conversaciones/${conversationId}/mensajes`)
      .set('Authorization', 'Bearer token-usuario-a')
      .send({
        rol: 'user',
        tipo: 'text',
        contenido: 'Hola, necesito ayuda',
        createdAt: '2026-07-28T12:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/mateo/conversaciones')
      .set('Authorization', 'Bearer token-usuario-b')
      .expect(200, []);

    await request(app.getHttpServer())
      .get(`/mateo/conversaciones/${conversationId}`)
      .set('Authorization', 'Bearer token-usuario-b')
      .expect(404);
  });

  it('mantiene continuidad y deduplica reintento normal del mismo mensaje', async () => {
    const created = await request(app.getHttpServer())
      .post('/mateo/conversaciones')
      .set('Authorization', 'Bearer token-usuario-a')
      .send({})
      .expect(201);
    const conversationId = created.body.idConversacion as string;

    const payload = {
      rol: 'user',
      tipo: 'text',
      contenido: 'Mensaje que se reintenta',
      createdAt: '2026-07-28T12:30:00.000Z',
    };

    await request(app.getHttpServer())
      .post(`/mateo/conversaciones/${conversationId}/mensajes`)
      .set('Authorization', 'Bearer token-usuario-a')
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/mateo/conversaciones/${conversationId}/mensajes`)
      .set('Authorization', 'Bearer token-usuario-a')
      .send(payload)
      .expect(201);

    const detalle1 = await request(app.getHttpServer())
      .get(`/mateo/conversaciones/${conversationId}`)
      .set('Authorization', 'Bearer token-usuario-a')
      .expect(200);

    expect(detalle1.body.mensajes).toHaveLength(1);
    expect(detalle1.body.mensajes[0]?.contenido).toBe(payload.contenido);

    // Simula reabrir app: nueva lectura posterior, mismo historial persistido.
    const detalle2 = await request(app.getHttpServer())
      .get(`/mateo/conversaciones/${conversationId}`)
      .set('Authorization', 'Bearer token-usuario-a')
      .expect(200);

    expect(detalle2.body.mensajes).toHaveLength(1);
    expect(detalle2.body.mensajes[0]?.createdAt).toBe(payload.createdAt);
  });

  it('GET /mateo/conversaciones/:id responde 404 si no pertenece al usuario', async () => {
    await request(app.getHttpServer())
      .get('/mateo/conversaciones/f3000001-0001-4001-8001-000000000099')
      .set('Authorization', 'Bearer token-usuario-a')
      .expect(404);
  });
});
