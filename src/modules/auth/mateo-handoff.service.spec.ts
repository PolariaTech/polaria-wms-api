import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  MateoHandoffService,
  MATEO_HANDOFF_TTL_SECONDS,
} from './mateo-handoff.service';

describe('MateoHandoffService', () => {
  let service: MateoHandoffService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-handoff-secret',
        }),
      ],
      providers: [
        MateoHandoffService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-handoff-secret'),
          },
        },
      ],
    }).compile();

    service = module.get(MateoHandoffService);
  });

  afterEach(async () => {
    service.onModuleDestroy();
    await module.close();
  });

  it('genera un código con TTL de 60 segundos', () => {
    const result = service.generateCode('auth-123');

    expect(result.expiresIn).toBe(MATEO_HANDOFF_TTL_SECONDS);
    expect(result.code).toEqual(expect.any(String));
  });

  it('canjea un código válido una sola vez', () => {
    const { code } = service.generateCode('auth-123');

    expect(service.redeemCode(code)).toBe('auth-123');
    expect(() => service.redeemCode(code)).toThrow(UnauthorizedException);
  });

  it('rechaza un código inválido', () => {
    expect(() => service.redeemCode('invalid-code')).toThrow(
      UnauthorizedException,
    );
  });
});
