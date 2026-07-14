import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import type { WarehouseStateResponse } from '../interfaces/warehouse-state.interfaces';

@Injectable()
export class WarehouseStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(idWarehouseState: string) {
    return this.prisma.warehouseState.findUnique({
      where: { idWarehouseState },
    });
  }

  list(where: Prisma.WarehouseStateWhereInput) {
    return this.prisma.warehouseState.findMany({
      where,
      orderBy: [{ idUbicacion: 'asc' }, { idProducto: 'asc' }],
    });
  }

  async lock(
    idWarehouseState: string,
    idUsuario: string,
    expectedVersion?: number,
    allowTakeover = false,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.warehouseState.findUnique({
        where: { idWarehouseState },
      });

      if (!current) {
        return null;
      }

      if (expectedVersion != null && current.version !== expectedVersion) {
        throw new ConflictException(
          'La posición cambió; recargue el mapa e intente de nuevo',
        );
      }

      if (
        current.lockedBy &&
        current.lockedBy !== idUsuario &&
        !allowTakeover
      ) {
        throw new ConflictException(
          'La posición ya está bloqueada por otro operario',
        );
      }

      return tx.warehouseState.update({
        where: { idWarehouseState },
        data: {
          lockedBy: idUsuario,
          lockedAt: new Date(),
          version: { increment: 1 },
        },
      });
    });
  }

  async unlock(idWarehouseState: string, idUsuario: string, force: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.warehouseState.findUnique({
        where: { idWarehouseState },
      });

      if (!current) {
        return null;
      }

      if (!current.lockedBy) {
        return current;
      }

      if (!force && current.lockedBy !== idUsuario) {
        throw new ForbiddenException(
          'Solo quien bloqueó la posición puede liberarla',
        );
      }

      return tx.warehouseState.update({
        where: { idWarehouseState },
        data: {
          lockedBy: null,
          lockedAt: null,
          version: { increment: 1 },
        },
      });
    });
  }

  toResponse(row: {
    idWarehouseState: string;
    codigoCuenta: string;
    idBodega: string;
    idUbicacion: string;
    idProducto: string;
    idLote: string | null;
    cantidad: Prisma.Decimal;
    cantidadReservada: Prisma.Decimal;
    temperatura: Prisma.Decimal | null;
    lockedBy: string | null;
    lockedAt: Date | null;
    version: number;
    updatedAt: Date;
  }): WarehouseStateResponse {
    return {
      idWarehouseState: row.idWarehouseState,
      codigoCuenta: row.codigoCuenta,
      idBodega: row.idBodega,
      idUbicacion: row.idUbicacion,
      idProducto: row.idProducto,
      idLote: row.idLote,
      cantidad: row.cantidad.toString(),
      cantidadReservada: row.cantidadReservada.toString(),
      temperatura: row.temperatura?.toString() ?? null,
      lockedBy: row.lockedBy,
      lockedAt: row.lockedAt,
      version: row.version,
      updatedAt: row.updatedAt,
    };
  }
}
