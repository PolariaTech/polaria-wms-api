import { Injectable } from '@nestjs/common';
import {
  applyTenantFilter,
  assertOperationalTenantScope,
} from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { TenantBodegaQueryDto } from '../dto/operations.dto';
import {
  BodegaReportesRepository,
  type BodegaReportesResumen,
} from '../infrastructure/bodega-reportes.repository';

@Injectable()
export class BodegaReportesService {
  constructor(private readonly repository: BodegaReportesRepository) {}

  async getResumen(
    query: TenantBodegaQueryDto,
    ctx: TenantContext,
  ): Promise<BodegaReportesResumen> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: query.codigoCuenta,
      idBodega: query.idBodega,
    });

    applyTenantFilter(
      { codigoCuenta: query.codigoCuenta, idBodega: query.idBodega },
      ctx,
    );

    return this.repository.getResumen(query.codigoCuenta, query.idBodega);
  }
}
