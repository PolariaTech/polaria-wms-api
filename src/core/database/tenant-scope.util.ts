import { ForbiddenException } from '@nestjs/common';
import { RolNivel } from '../../generated/prisma/client';
import type { TenantContext } from '../tenant/tenant-context.interface';
import { isConfigurador } from '../../shared/constants/roles';

/** Payload operativo mínimo (tablas POL-33: codigo_cuenta + id_bodega). */
export interface OperationalTenantPayload {
  codigoCuenta: string;
  idBodega: string;
}

type PrismaWhere = Record<string, unknown>;

/**
 * Fusiona filtros tenant en un `where` de Prisma para tablas operativas.
 * Configurador: sin restricción adicional. Resto: acota por cuenta y/o bodegas asignadas.
 */
export function applyTenantFilter<W extends PrismaWhere>(
  where: W,
  ctx: TenantContext,
): W {
  if (isConfigurador(ctx.idRol)) {
    return where;
  }

  const scoped: PrismaWhere = { ...where };

  if (ctx.codigoCuenta) {
    scoped.codigoCuenta = ctx.codigoCuenta;
  }

  if (ctx.nivelRol === RolNivel.bodega && ctx.idBodegas.length > 0) {
    scoped.idBodega =
      ctx.idBodegas.length === 1 ? ctx.idBodegas[0] : { in: ctx.idBodegas };
  }

  return scoped as W;
}

/**
 * Valida que codigoCuenta e idBodega del body/DTO pertenezcan al contexto del usuario.
 * Nunca confiar en valores del cliente sin esta comprobación (Prisma bypass RLS).
 */
export function assertOperationalTenantScope(
  ctx: TenantContext,
  payload: OperationalTenantPayload,
): void {
  if (isConfigurador(ctx.idRol)) {
    return;
  }

  if (ctx.codigoCuenta && payload.codigoCuenta !== ctx.codigoCuenta) {
    throw new ForbiddenException(
      'La cuenta indicada no pertenece a su contexto de tenant',
    );
  }

  if (!ctx.codigoCuenta && ctx.codigoEmpresa) {
    if (!ctx.codigosCuentaEmpresa.includes(payload.codigoCuenta)) {
      throw new ForbiddenException(
        'La cuenta indicada no pertenece a su empresa',
      );
    }
  }

  if (ctx.nivelRol === RolNivel.bodega) {
    if (!ctx.idBodegas.includes(payload.idBodega)) {
      throw new ForbiddenException(
        'La bodega indicada no está asignada al usuario',
      );
    }
  }
}
