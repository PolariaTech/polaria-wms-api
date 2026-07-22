import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { SupabaseAuthService } from '../src/core/auth/supabase-auth.service';
import { GlobalExceptionFilter } from '../src/core/filters/global-exception.filter';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { TenantGuard } from '../src/core/guards/tenant.guard';
import { TenantService } from '../src/core/tenant/tenant.service';
import { RolNivel, WmsRol } from '../src/generated/prisma/client';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsuarioRepository } from '../src/modules/auth/infrastructure/usuario.repository';
import { MateoHandoffService } from '../src/modules/auth/mateo-handoff.service';
import {
  MATEO_WIDGET_JWT_DEFAULT_AUDIENCE,
  MATEO_WIDGET_JWT_DEFAULT_ISSUER,
  MATEO_WIDGET_JWT_TTL_SECONDS,
  MateoWidgetTokenService,
} from '../src/modules/auth/mateo-widget-token.service';
import { JwtService } from '@nestjs/jwt';

describe('Mateo widget auth (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let supabaseAuth: { getUserFromToken: jest.Mock };
  let usuarioRepository: { findActiveByIdAuth: jest.Mock };

  const mockUsuario = {
    idAuth: '33333333-3333-3333-3333-333333333333',
    idUsuario: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    codigoEmpresa: 'ACME',
    codigoCuenta: 'ACME-01',
    idRol: WmsRol.operador_cuenta,
    correo: 'ops@acme.test',
    nombre: 'Operador ACME',
    estaActivo: true,
  };

  const mockTenantContext = {
    idUsuario: mockUsuario.idUsuario,
    idRol: mockUsuario.idRol,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: mockUsuario.codigoEmpresa,
    codigoCuenta: mockUsuario.codigoCuenta,
    codigosCuentaEmpresa: ['ACME-01'],
    idBodegas: [],
  };

  beforeEach(async () => {
    supabaseAuth = {
      getUserFromToken: jest.fn().mockResolvedValue({ id: mockUsuario.idAuth }),
    };
    usuarioRepository = {
      findActiveByIdAuth: jest.fn().mockResolvedValue(mockUsuario),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-handoff-secret',
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        MateoWidgetTokenService,
        {
          provide: MateoHandoffService,
          useValue: { generateCode: jest.fn(), redeemCode: jest.fn() },
        },
        { provide: UsuarioRepository, useValue: usuarioRepository },
        { provide: SupabaseAuthService, useValue: supabaseAuth },
        {
          provide: TenantService,
          useValue: {
            buildContext: jest.fn().mockResolvedValue(mockTenantContext),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'MATEO_WIDGET_JWT_SECRET') return 'test-widget-secret';
              if (key === 'MATEO_HANDOFF_SECRET') return 'test-handoff-secret';
              throw new Error(`missing config ${key}`);
            }),
            get: jest.fn().mockReturnValue(undefined),
          },
        },
        JwtAuthGuard,
        TenantGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get(JwtService);
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

  it('POST /auth/mateo/widget-token responde 401 sin Bearer', async () => {
    await request(app.getHttpServer())
      .post('/auth/mateo/widget-token')
      .expect(401);
  });

  it('POST /auth/mateo/widget-token responde 401 con Bearer inválido', async () => {
    supabaseAuth.getUserFromToken.mockRejectedValue(
      new UnauthorizedException('Token inválido o expirado'),
    );

    await request(app.getHttpServer())
      .post('/auth/mateo/widget-token')
      .set('Authorization', 'Bearer token-manipulado')
      .expect(401);
  });

  it('POST /auth/mateo/widget-token responde 404 si usuario inactivo', async () => {
    usuarioRepository.findActiveByIdAuth.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/auth/mateo/widget-token')
      .set('Authorization', 'Bearer sesion-valida')
      .expect(404);
  });

  it('POST /auth/mateo/widget-token emite JWT con claims de tenant', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/mateo/widget-token')
      .set('Authorization', 'Bearer sesion-valida')
      .expect(200);

    expect(response.body.expiresIn).toBe(MATEO_WIDGET_JWT_TTL_SECONDS);

    const payload = jwtService.verify(response.body.token, {
      secret: 'test-widget-secret',
      issuer: MATEO_WIDGET_JWT_DEFAULT_ISSUER,
      audience: MATEO_WIDGET_JWT_DEFAULT_AUDIENCE,
    }) as {
      sub: string;
      idUsuario: string;
      codigoEmpresa: string;
      codigoCuenta: string;
      idRol: string;
      email: string;
    };

    expect(payload.sub).toBe(mockUsuario.idAuth);
    expect(payload.idUsuario).toBe(mockUsuario.idUsuario);
    expect(payload.codigoEmpresa).toBe('ACME');
    expect(payload.codigoCuenta).toBe('ACME-01');
    expect(payload.idRol).toBe(WmsRol.operador_cuenta);
    expect(payload.email).toBe('ops@acme.test');
  });
});
