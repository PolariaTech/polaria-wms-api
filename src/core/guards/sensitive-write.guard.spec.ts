import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolNivel, WmsRol } from '../../generated/prisma/client';
import type { TenantContext } from '../tenant/tenant-context.interface';
import { SensitiveWriteGuard } from './sensitive-write.guard';

const mockExecutionContext = (tenantContext?: TenantContext) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ tenantContext }),
    }),
  }) as ExecutionContext;

describe('SensitiveWriteGuard', () => {
  const guard = new SensitiveWriteGuard();

  it('permite jefe_bodega', () => {
    expect(
      guard.canActivate(
        mockExecutionContext({
          idUsuario: 'u1',
          idRol: WmsRol.jefe_bodega,
          nivelRol: RolNivel.bodega,
          codigoEmpresa: 'EMP001',
          codigoCuenta: 'CTA001',
          idBodegas: ['b1'],
        }),
      ),
    ).toBe(true);
  });

  it('permite configurador (bypass)', () => {
    expect(
      guard.canActivate(
        mockExecutionContext({
          idUsuario: 'u1',
          idRol: WmsRol.configurador,
          nivelRol: RolNivel.plataforma,
          codigoEmpresa: null,
          codigoCuenta: null,
          idBodegas: [],
        }),
      ),
    ).toBe(true);
  });

  it('permite operario con permiso de escritura de inventario', () => {
    expect(
      guard.canActivate(
        mockExecutionContext({
          idUsuario: 'u1',
          idRol: WmsRol.operario,
          nivelRol: RolNivel.bodega,
          codigoEmpresa: 'EMP001',
          codigoCuenta: 'CTA001',
          idBodegas: ['b1'],
        }),
      ),
    ).toBe(true);
  });

  it('rechaza sin tenantContext', () => {
    expect(() => guard.canActivate(mockExecutionContext())).toThrow(
      ForbiddenException,
    );
  });
});
