import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { ROLES_KEY } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import type { SupabaseAuthService } from '../../../core/auth/supabase-auth.service';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { PedidoIaApiKeyGuard } from '../guards/pedido-ia-api-key.guard';
import {
  OrdenTrabajoReagrupacionController,
  ROLES_REAGRUPACION_OT,
} from './orden-trabajo-reagrupacion.controller';

function contexto(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => OrdenTrabajoReagrupacionController.prototype.proponer,
    getClass: () => OrdenTrabajoReagrupacionController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function tenant(idRol: WmsRol): TenantContext {
  return {
    idUsuario: 'u-1',
    idRol,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    codigosCuentaEmpresa: ['CTA001'],
    idBodegas: [],
    schemaName: 'emp_andino',
  };
}

describe('OrdenTrabajoReagrupacionController (CA1, R1)', () => {
  it('protege toda la clase con JWT + tenant + roles y NO con la API key de integración', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      OrdenTrabajoReagrupacionController,
    ) as unknown[];

    expect(guards).toEqual([JwtAuthGuard, TenantGuard, RolesGuard]);
    expect(guards).not.toContain(PedidoIaApiKeyGuard);
  });

  it('restringe el endpoint a operador_cuenta y administrador_cuenta', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      OrdenTrabajoReagrupacionController.prototype.proponer,
    ) as WmsRol[];

    expect([...roles].sort()).toEqual(
      [WmsRol.administrador_cuenta, WmsRol.operador_cuenta].sort(),
    );
    expect(roles).toEqual([...ROLES_REAGRUPACION_OT]);
  });

  it('expone POST ventas/ordenes/:id/ordenes-trabajo/propuesta-reagrupacion', () => {
    expect(
      Reflect.getMetadata('path', OrdenTrabajoReagrupacionController),
    ).toBe('ventas/ordenes');
    expect(
      Reflect.getMetadata(
        'path',
        OrdenTrabajoReagrupacionController.prototype.proponer,
      ),
    ).toBe(':id/ordenes-trabajo/propuesta-reagrupacion');
  });

  it('JwtAuthGuard real: sin token responde 401 sin consultar a Supabase', async () => {
    const getUserFromToken = jest.fn();
    const guard = new JwtAuthGuard({
      getUserFromToken,
    } as unknown as SupabaseAuthService);

    await expect(
      guard.canActivate(contexto({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getUserFromToken).not.toHaveBeenCalled();
  });

  it('RolesGuard real: rechaza roles no permitidos con 403 y deja pasar a los permitidos', () => {
    const guard = new RolesGuard(new Reflector());

    for (const rol of [
      WmsRol.jefe_bodega,
      WmsRol.operario,
      WmsRol.custodio,
      WmsRol.administrador_bodega,
      WmsRol.configurador,
    ]) {
      expect(() =>
        guard.canActivate(contexto({ tenantContext: tenant(rol) })),
      ).toThrow(ForbiddenException);
    }

    for (const rol of ROLES_REAGRUPACION_OT) {
      expect(guard.canActivate(contexto({ tenantContext: tenant(rol) }))).toBe(
        true,
      );
    }
  });

  it('RolesGuard real: sin contexto de tenant responde 403', () => {
    const guard = new RolesGuard(new Reflector());
    expect(() => guard.canActivate(contexto({}))).toThrow(ForbiddenException);
  });
});
