import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { ROLES_KEY } from '../../../core/guards/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { TenantGuard } from '../../../core/guards/tenant.guard';
import type { SupabaseAuthService } from '../../../core/auth/supabase-auth.service';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { TECHOS_PROVISIONALES_REAGRUPACION } from '../ai/utils/reagrupacion-ot.validator';
import { PropuestaReagrupacionBodyDto } from '../dto/propuesta-reagrupacion.dto';
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

describe('Validación del body del endpoint (mismo ValidationPipe que main.ts)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const validar = (body: unknown) =>
    pipe.transform(body, {
      type: 'body',
      metatype: PropuestaReagrupacionBodyDto,
    });

  const bodyValido = () => ({
    requestId: '770e8400-e29b-41d4-a716-446655440002',
    instruccion: 'Junta las OT de comedor y de bares',
    historial: [] as Array<{ instruccion: string }>,
    estadoBase: {
      ots: [
        {
          otId: 'ot-1',
          etiqueta: 'PO-1 — COMEDOR',
          almacen: 'COMEDOR',
          numeroPedido: 'PO-1',
          renglones: [
            {
              renglonId: 'l-1',
              producto: 'Aguacate',
              cantidad: 25,
              unidad: 'KGM',
            },
          ],
        },
      ],
    },
  });

  it('acepta un body válido, incluso con 1 sola OT', async () => {
    await expect(validar(bodyValido())).resolves.toBeInstanceOf(
      PropuestaReagrupacionBodyDto,
    );
  });

  it('R2: rechaza con 400 un codigoCuenta en el body (la cuenta sale del JWT)', async () => {
    await expect(
      validar({ ...bodyValido(), codigoCuenta: 'CTA-AJENA' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza con 400 una instrucción vacía o de solo espacios', async () => {
    for (const instruccion of ['', '   ', String.fromCharCode(10, 9)]) {
      await expect(
        validar({ ...bodyValido(), instruccion }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('aplica el techo del historial: el máximo pasa y uno más responde 400', async () => {
    const historial = (cantidad: number) =>
      Array.from({ length: cantidad }, (_, indice) => ({
        instruccion: `instrucción ${indice + 1}`,
      }));
    const maximo = TECHOS_PROVISIONALES_REAGRUPACION.maxHistorial;

    await expect(
      validar({ ...bodyValido(), historial: historial(maximo) }),
    ).resolves.toBeInstanceOf(PropuestaReagrupacionBodyDto);
    await expect(
      validar({ ...bodyValido(), historial: historial(maximo + 1) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('R5: rechaza con 400 campos extra en OT y renglones (notas, teléfono)', async () => {
    const conNotaEnOt = bodyValido();
    Object.assign(conNotaEnOt.estadoBase.ots[0], { notas: 'nota privada' });
    await expect(validar(conNotaEnOt)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const conTelefonoEnRenglon = bodyValido();
    Object.assign(conTelefonoEnRenglon.estadoBase.ots[0].renglones[0], {
      telefono: '5551234567',
    });
    await expect(validar(conTelefonoEnRenglon)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza con 400 un requestId que no es UUID', async () => {
    await expect(
      validar({ ...bodyValido(), requestId: 'no-es-uuid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
