import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolNivel, WmsRol } from '../../generated/prisma/client';
import { TenantService } from '../tenant/tenant.service';
import type { TenantContext } from '../tenant/tenant-context.interface';
import { TenantGuard } from './tenant.guard';

const mockExecutionContext = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as ExecutionContext;

const mockTenantContext: TenantContext = {
  idUsuario: 'usr-tenant',
  idRol: WmsRol.administrador_cuenta,
  nivelRol: RolNivel.cuenta,
  codigoEmpresa: 'EMP001',
  codigoCuenta: null,
  idBodegas: [],
};

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let tenantService: jest.Mocked<TenantService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantGuard,
        {
          provide: TenantService,
          useValue: {
            buildContext: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get(TenantGuard);
    tenantService = module.get(TenantService);
  });

  it('permite configurador sin validar codigoEmpresa solicitado', async () => {
    const configuradorContext: TenantContext = {
      idUsuario: 'usr-config',
      idRol: WmsRol.configurador,
      nivelRol: RolNivel.plataforma,
      codigoEmpresa: null,
      codigoCuenta: null,
      idBodegas: [],
    };
    tenantService.buildContext.mockResolvedValue(configuradorContext);

    const request = {
      headers: { 'x-codigo-empresa': 'OTRA' },
      query: {},
      supabaseUser: { id: 'auth-config' },
    };

    await expect(
      guard.canActivate(mockExecutionContext(request)),
    ).resolves.toBe(true);

    expect(tenantService.buildContext).toHaveBeenCalledWith(
      'auth-config',
      'OTRA',
    );
    expect(request.tenantContext).toEqual(configuradorContext);
  });

  it('inyecta contexto tenant válido', async () => {
    tenantService.buildContext.mockResolvedValue(mockTenantContext);

    const request = {
      headers: {},
      query: { codigoEmpresa: 'EMP001' },
      supabaseUser: { id: 'auth-tenant' },
    };

    await expect(
      guard.canActivate(mockExecutionContext(request)),
    ).resolves.toBe(true);

    expect(tenantService.buildContext).toHaveBeenCalledWith(
      'auth-tenant',
      'EMP001',
    );
    expect(request.tenantContext).toEqual(mockTenantContext);
  });

  it('rechaza cross-tenant cuando codigoEmpresa no coincide', async () => {
    tenantService.buildContext.mockRejectedValue(
      new ForbiddenException('El usuario no pertenece a la empresa indicada'),
    );

    const request = {
      headers: { 'x-codigo-empresa': 'OTRA' },
      query: {},
      supabaseUser: { id: 'auth-tenant' },
    };

    await expect(
      guard.canActivate(mockExecutionContext(request)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza request sin supabaseUser', async () => {
    const request = { headers: {}, query: {} };

    await expect(
      guard.canActivate(mockExecutionContext(request)),
    ).rejects.toThrow(UnauthorizedException);

    expect(tenantService.buildContext).not.toHaveBeenCalled();
  });
});
