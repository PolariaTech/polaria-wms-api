import { BadRequestException, Injectable } from '@nestjs/common';
import {
  applyTenantFilter,
  assertOperationalTenantScope,
} from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { BodegaReportesQueryDto } from '../dto/operations.dto';
import {
  BodegaReportesRepository,
  type BodegaReportesResumen,
} from '../infrastructure/bodega-reportes.repository';
import { resolveBodegaReportesFechaRange } from '../utils/bodega-reportes-fecha-range.util';

@Injectable()
export class BodegaReportesService {
  constructor(private readonly repository: BodegaReportesRepository) {}

  async getResumen(
    query: BodegaReportesQueryDto,
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

    const rango = resolveBodegaReportesFechaRange({
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
    });

    if (rango.desdeAt.getTime() > rango.hastaAt.getTime()) {
      throw new BadRequestException(
        'fechaDesde no puede ser posterior a fechaHasta',
      );
    }

    return this.repository.getResumen(
      query.codigoCuenta,
      query.idBodega,
      rango,
    );
  }
}
