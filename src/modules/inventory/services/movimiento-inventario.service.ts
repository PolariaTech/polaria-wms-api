import { BadRequestException, Injectable } from '@nestjs/common';
import {
  applyTenantFilter,
  assertOperationalTenantScope,
} from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { ListMovimientosInventarioQueryDto } from '../dto/movimiento-inventario.dto';
import { MovimientoInventarioRepository } from '../infrastructure/movimiento-inventario.repository';
import type { MovimientoInventarioResponse } from '../interfaces/movimiento-inventario.interfaces';

@Injectable()
export class MovimientoInventarioService {
  constructor(private readonly repository: MovimientoInventarioRepository) {}

  async list(
    query: ListMovimientosInventarioQueryDto,
    ctx: TenantContext,
  ): Promise<MovimientoInventarioResponse[]> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: query.codigoCuenta,
      idBodega: query.idBodega,
    });

    const tipo = query.tipoMovimiento
      ? MovimientoInventarioRepository.parseTipoMovimiento(query.tipoMovimiento)
      : undefined;

    if (query.tipoMovimiento && !tipo) {
      throw new BadRequestException('tipoMovimiento no válido');
    }

    const where = applyTenantFilter(
      {
        idBodega: query.idBodega,
        ...(query.idProducto ? { idProducto: query.idProducto } : {}),
        ...(tipo ? { tipoMovimiento: tipo } : {}),
        ...(query.idReferencia ? { idReferencia: query.idReferencia } : {}),
        ...(query.idUbicacion
          ? MovimientoInventarioRepository.buildWhereUbicacion(
              query.idUbicacion,
            )
          : {}),
      },
      ctx,
    );

    const rows = await this.repository.list(where);
    return rows.map((row) => this.repository.toResponse(row));
  }
}
