import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DestinoTipo } from '../../../generated/prisma/client';
import {
  applyTenantFilter,
  assertOperationalTenantScope,
} from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { isConfigurador } from '../../../shared/constants/roles';
import type { ListBodegasDestinoQueryDto } from '../dto/list-bodegas-destino-query.dto';
import { BodegaDestinoRepository } from '../infrastructure/bodega-destino.repository';
import type { BodegaDestinoResponse } from '../interfaces/bodega-destino.interfaces';
import { destinoTipoToBodegaTipo } from '../utils/destino-tipo.util';

export interface OrdenDestinoPayload {
  codigoCuenta: string;
  idBodega: string;
  destinoTipo: DestinoTipo;
}

@Injectable()
export class BodegaDestinoService {
  constructor(private readonly repository: BodegaDestinoRepository) {}

  async listBodegasDestino(
    query: ListBodegasDestinoQueryDto,
    ctx: TenantContext,
  ): Promise<BodegaDestinoResponse[]> {
    const codigoCuenta = query.codigoCuenta.trim();
    this.assertCodigoCuentaScope(codigoCuenta, ctx);

    const where = applyTenantFilter(
      {
        codigoCuenta,
        tipo: destinoTipoToBodegaTipo(query.tipo),
      },
      ctx,
    );

    const bodegas = await this.repository.listActivasByCuentaYTipo(where);
    const slotsPorBodega =
      await this.repository.countSlotsLibresAlmacenamientoByBodega(
        bodegas.map((bodega) => bodega.idBodega),
      );

    return bodegas
      .map((bodega) => {
        const libresEnUbicaciones = slotsPorBodega.get(bodega.idBodega) ?? 0;
        const slotsLibres = this.repository.resolveSlotsLibres(
          bodega,
          libresEnUbicaciones,
        );

        return {
          idBodega: bodega.idBodega,
          codigoCuenta: bodega.codigoCuenta,
          codigo: bodega.codigo,
          nombre: bodega.nombre,
          tipo: bodega.tipo,
          capacidadSlots: bodega.capacidadSlots,
          slotsLibres,
        };
      })
      .filter((bodega) => bodega.slotsLibres >= 1);
  }

  async validateOrdenDestino(
    payload: OrdenDestinoPayload,
    ctx: TenantContext,
  ): Promise<void> {
    if (!payload.destinoTipo) {
      throw new BadRequestException(
        'Debe indicar el tipo de destino (interna o externa)',
      );
    }

    if (!payload.idBodega) {
      throw new BadRequestException('Debe indicar la bodega destino');
    }

    assertOperationalTenantScope(ctx, {
      codigoCuenta: payload.codigoCuenta,
      idBodega: payload.idBodega,
    });

    const bodega = await this.repository.findById(payload.idBodega);

    if (!bodega) {
      throw new NotFoundException('Bodega destino no encontrada');
    }

    if (!bodega.estaActiva) {
      throw new BadRequestException('La bodega destino está inactiva');
    }

    if (bodega.codigoCuenta !== payload.codigoCuenta) {
      throw new BadRequestException(
        'La bodega destino no pertenece a la cuenta de la orden',
      );
    }

    const tipoEsperado = destinoTipoToBodegaTipo(payload.destinoTipo);
    if (bodega.tipo !== tipoEsperado) {
      throw new BadRequestException(
        `La bodega destino debe ser de tipo ${tipoEsperado} según el destino indicado`,
      );
    }

    const slotsLibres = await this.getSlotsLibres(bodega.idBodega);
    if (slotsLibres < 1) {
      throw new BadRequestException(
        'La bodega destino no tiene capacidad disponible (sin slots libres)',
      );
    }
  }

  private async getSlotsLibres(idBodega: string): Promise<number> {
    const bodega = await this.repository.findById(idBodega);
    if (!bodega) {
      return 0;
    }

    const counts =
      await this.repository.countSlotsLibresAlmacenamientoByBodega([idBodega]);
    return this.repository.resolveSlotsLibres(
      bodega,
      counts.get(idBodega) ?? 0,
    );
  }

  private assertCodigoCuentaScope(
    codigoCuenta: string,
    ctx: TenantContext,
  ): void {
    if (isConfigurador(ctx.idRol)) {
      return;
    }

    if (ctx.codigoCuenta && codigoCuenta !== ctx.codigoCuenta) {
      throw new ForbiddenException(
        'La cuenta indicada no pertenece a su contexto de tenant',
      );
    }
  }
}
