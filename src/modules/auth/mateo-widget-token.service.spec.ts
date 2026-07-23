import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { WmsRol } from '../../generated/prisma/client';
import {
  MateoWidgetTokenService,
  MATEO_WIDGET_JWT_DEFAULT_AUDIENCE,
  MATEO_WIDGET_JWT_DEFAULT_ISSUER,
  MATEO_WIDGET_JWT_DEFAULT_KID,
  MATEO_WIDGET_JWT_TTL_SECONDS,
} from './mateo-widget-token.service';

describe('MateoWidgetTokenService', () => {
  let service: MateoWidgetTokenService;
  let jwtService: JwtService;
  let module: TestingModule;

  const usuario = {
    idAuth: 'auth-123',
    idUsuario: 'usr-1',
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    idRol: WmsRol.administrador_cuenta,
    correo: 'admin@empresa.com',
    nombre: 'Ana Pérez',
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-widget-secret',
        }),
      ],
      providers: [
        MateoWidgetTokenService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-widget-secret'),
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(MateoWidgetTokenService);
    jwtService = module.get(JwtService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('genera un JWT reutilizable con TTL de 300 segundos y claims n8n', () => {
    const result = service.generateToken(usuario);

    expect(result.expiresIn).toBe(MATEO_WIDGET_JWT_TTL_SECONDS);
    expect(result.token).toEqual(expect.any(String));

    const payload = jwtService.verify<{
      sub: string;
      jti: string;
      idUsuario: string;
      email: string;
      idRol: string;
      given_name?: string;
      family_name?: string;
      iss?: string;
      aud?: string | string[];
    }>(result.token, {
      secret: 'test-widget-secret',
      issuer: MATEO_WIDGET_JWT_DEFAULT_ISSUER,
      audience: MATEO_WIDGET_JWT_DEFAULT_AUDIENCE,
    });

    expect(payload.sub).toBe('auth-123');
    expect(payload.idUsuario).toBe('usr-1');
    expect(payload.email).toBe('admin@empresa.com');
    expect(payload.idRol).toBe(WmsRol.administrador_cuenta);
    expect(payload.jti).toEqual(expect.any(String));
    expect(payload.given_name).toBe('Ana');
    expect(payload.family_name).toBe('Pérez');
    expect(payload.iss).toBe(MATEO_WIDGET_JWT_DEFAULT_ISSUER);
    expect(payload.aud).toBe(MATEO_WIDGET_JWT_DEFAULT_AUDIENCE);

    const payloadWithRol = jwtService.verify<{ rol: string }>(result.token, {
      secret: 'test-widget-secret',
      issuer: MATEO_WIDGET_JWT_DEFAULT_ISSUER,
      audience: MATEO_WIDGET_JWT_DEFAULT_AUDIENCE,
    });
    expect(payloadWithRol.rol).toBe(WmsRol.administrador_cuenta);

    const [headerB64] = result.token.split('.');
    const header = JSON.parse(
      Buffer.from(headerB64, 'base64url').toString('utf8'),
    ) as { kid?: string; alg?: string };
    expect(header.alg).toBe('HS256');
    expect(header.kid).toBe(MATEO_WIDGET_JWT_DEFAULT_KID);
  });

  it('permite reutilizar el mismo token hasta que expire (no one-time)', () => {
    const { token } = service.generateToken(usuario);

    const first = jwtService.verify(token, {
      secret: 'test-widget-secret',
      issuer: MATEO_WIDGET_JWT_DEFAULT_ISSUER,
      audience: MATEO_WIDGET_JWT_DEFAULT_AUDIENCE,
    });
    const second = jwtService.verify(token, {
      secret: 'test-widget-secret',
      issuer: MATEO_WIDGET_JWT_DEFAULT_ISSUER,
      audience: MATEO_WIDGET_JWT_DEFAULT_AUDIENCE,
    });

    expect(first).toEqual(second);
  });
});
