import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BodegaTipo, WmsRol } from '../../../generated/prisma/client';
import { ROL_PLATAFORMA } from '../../../shared/constants/roles';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { resolveCapacidadSlots } from '../constants/warehouse-layout.constants';
import { BodegaLayoutRepository } from '../infrastructure/bodega-layout.repository';
import type { BootstrapLayoutResult } from '../interfaces/bodega-layout.interfaces';

@Injectable()
export class BodegaLayoutBootstrapService {
  constructor(private readonly layoutRepository: BodegaLayoutRepository) {}

  async bootstrapLayout(
    idBodega: string,
    ctx: TenantContext,
  ): Promise<BootstrapLayoutResult> {
    const bodega = await this.layoutRepository.findBodega(idBodega);

    if (!bodega) {
      throw new NotFoundException('Bodega no encontrada');
    }

    if (!bodega.estaActiva) {
      throw new ForbiddenException('La bodega está inactiva');
    }

    if (bodega.tipo !== BodegaTipo.interna) {
      throw new BadRequestException(
        'Solo las bodegas internas admiten bootstrap de layout',
      );
    }

    this.assertTenantAccess(bodega.codigoCuenta, ctx);

    const ubicacionesExistentes =
      await this.layoutRepository.countUbicaciones(idBodega);

    if (ubicacionesExistentes > 0) {
      throw new ConflictException(
        'La bodega ya tiene ubicaciones configuradas',
      );
    }

    const capacidadSlots = resolveCapacidadSlots(bodega.capacidadSlots);

    return this.layoutRepository.bootstrapLayout(bodega, capacidadSlots);
  }

  private assertTenantAccess(
    codigoCuentaBodega: string,
    ctx: TenantContext,
  ): void {
    if (ctx.idRol === ROL_PLATAFORMA) {
      return;
    }

    if (ctx.idRol === WmsRol.administrador_cuenta) {
      if (!ctx.codigoCuenta || ctx.codigoCuenta !== codigoCuentaBodega) {
        throw new ForbiddenException(
          'La bodega no pertenece a la cuenta del administrador',
        );
      }
      return;
    }

    throw new ForbiddenException('No tiene permisos para esta operación');
  }
}
