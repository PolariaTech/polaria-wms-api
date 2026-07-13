import { Injectable } from '@nestjs/common';
import { Prisma, TipoMovimiento } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import type { MovimientoInventarioResponse } from '../interfaces/movimiento-inventario.interfaces';

export type MovimientoRow = Prisma.MovimientoInventarioGetPayload<object>;

@Injectable()
export class MovimientoInventarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(where: Prisma.MovimientoInventarioWhereInput): Promise<MovimientoRow[]> {
    return this.prisma.movimientoInventario.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  toResponse(row: MovimientoRow): MovimientoInventarioResponse {
    return {
      idMovimientoInventario: row.idMovimientoInventario,
      codigoCuenta: row.codigoCuenta,
      idBodega: row.idBodega,
      idUbicacionOrigen: row.idUbicacionOrigen,
      idUbicacionDestino: row.idUbicacionDestino,
      idProducto: row.idProducto,
      idLote: row.idLote,
      cantidad: row.cantidad.toString(),
      tipoMovimiento: row.tipoMovimiento,
      idUsuario: row.idUsuario,
      idReferencia: row.idReferencia,
      tipoReferencia: row.tipoReferencia,
      createdAt: row.createdAt,
    };
  }

  static buildWhereUbicacion(
    idUbicacion: string,
  ): Prisma.MovimientoInventarioWhereInput {
    return {
      OR: [
        { idUbicacionOrigen: idUbicacion },
        { idUbicacionDestino: idUbicacion },
      ],
    };
  }

  static parseTipoMovimiento(value: string): TipoMovimiento | null {
    const valores = Object.values(TipoMovimiento) as string[];
    return valores.includes(value) ? (value as TipoMovimiento) : null;
  }
}
