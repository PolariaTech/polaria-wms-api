import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WmsRol } from '../../../generated/prisma/client';
import {
  applyTenantFilter,
  assertOperationalTenantScope,
} from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import {
  LOCK_STALE_MS,
  ROLES_INVENTARIO_FORCE_UNLOCK,
} from '../constants/inventory.constants';
import type {
  ListWarehouseStateQueryDto,
  LockWarehouseStateDto,
} from '../dto/warehouse-state.dto';
import { WarehouseStateRepository } from '../infrastructure/warehouse-state.repository';
import type { WarehouseStateResponse } from '../interfaces/warehouse-state.interfaces';

@Injectable()
export class WarehouseStateService {
  constructor(private readonly repository: WarehouseStateRepository) {}

  async list(
    query: ListWarehouseStateQueryDto,
    ctx: TenantContext,
  ): Promise<WarehouseStateResponse[]> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: ctx.codigoCuenta ?? '',
      idBodega: query.idBodega,
    });

    const where = applyTenantFilter(
      {
        idBodega: query.idBodega,
        ...(query.idUbicacion ? { idUbicacion: query.idUbicacion } : {}),
        ...(query.idProducto ? { idProducto: query.idProducto } : {}),
      },
      ctx,
    );

    const rows = await this.repository.list(where);
    return rows.map((row) => this.repository.toResponse(row));
  }

  async lock(
    idWarehouseState: string,
    dto: LockWarehouseStateDto,
    ctx: TenantContext,
  ): Promise<WarehouseStateResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const existing = await this.repository.findById(idWarehouseState);

    if (!existing) {
      throw new NotFoundException('Posición de inventario no encontrada');
    }

    if (
      existing.codigoCuenta !== dto.codigoCuenta ||
      existing.idBodega !== dto.idBodega
    ) {
      throw new ForbiddenException(
        'La posición no pertenece al tenant indicado',
      );
    }

    if (
      existing.lockedBy &&
      existing.lockedBy !== ctx.idUsuario &&
      !this.canForceUnlock(ctx.idRol) &&
      !this.isLockStale(existing.lockedAt)
    ) {
      throw new ConflictException(
        'La posición está bloqueada por otro operario',
      );
    }

    const allowTakeover =
      this.canForceUnlock(ctx.idRol) || this.isLockStale(existing.lockedAt);

    const updated = await this.repository.lock(
      idWarehouseState,
      ctx.idUsuario,
      dto.expectedVersion,
      allowTakeover,
    );

    if (!updated) {
      throw new NotFoundException('Posición de inventario no encontrada');
    }

    return this.repository.toResponse(updated);
  }

  async unlock(
    idWarehouseState: string,
    dto: LockWarehouseStateDto,
    ctx: TenantContext,
  ): Promise<WarehouseStateResponse> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: dto.codigoCuenta,
      idBodega: dto.idBodega,
    });

    const existing = await this.repository.findById(idWarehouseState);

    if (!existing) {
      throw new NotFoundException('Posición de inventario no encontrada');
    }

    if (
      existing.codigoCuenta !== dto.codigoCuenta ||
      existing.idBodega !== dto.idBodega
    ) {
      throw new ForbiddenException(
        'La posición no pertenece al tenant indicado',
      );
    }

    const force = this.canForceUnlock(ctx.idRol);

    const updated = await this.repository.unlock(
      idWarehouseState,
      ctx.idUsuario,
      force,
    );

    if (!updated) {
      throw new NotFoundException('Posición de inventario no encontrada');
    }

    return this.repository.toResponse(updated);
  }

  private canForceUnlock(idRol: WmsRol): boolean {
    return (ROLES_INVENTARIO_FORCE_UNLOCK as readonly WmsRol[]).includes(idRol);
  }

  private isLockStale(lockedAt: Date | null): boolean {
    if (!lockedAt) {
      return false;
    }

    return Date.now() - lockedAt.getTime() > LOCK_STALE_MS;
  }
}
