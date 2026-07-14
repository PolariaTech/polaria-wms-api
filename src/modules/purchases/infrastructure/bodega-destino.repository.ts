import { Injectable } from '@nestjs/common';
import {
  BodegaTipo,
  EstadoSlot,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import type { BodegaDestinoRecord } from '../interfaces/bodega-destino.interfaces';

const bodegaDestinoSelect = {
  idBodega: true,
  codigoCuenta: true,
  codigo: true,
  nombre: true,
  tipo: true,
  capacidadSlots: true,
  estaActiva: true,
} satisfies Prisma.BodegaSelect;

@Injectable()
export class BodegaDestinoRepository {
  constructor(private readonly prisma: PrismaService) {}

  listActivasByCuentaYTipo(
    where: Prisma.BodegaWhereInput,
  ): Promise<BodegaDestinoRecord[]> {
    return this.prisma.bodega.findMany({
      where: {
        ...where,
        estaActiva: true,
      },
      select: bodegaDestinoSelect,
      orderBy: { nombre: 'asc' },
    });
  }

  findById(idBodega: string): Promise<BodegaDestinoRecord | null> {
    return this.prisma.bodega.findUnique({
      where: { idBodega },
      select: bodegaDestinoSelect,
    });
  }

  async countSlotsLibresAlmacenamientoByBodega(
    idBodegas: string[],
  ): Promise<Map<string, number>> {
    if (idBodegas.length === 0) {
      return new Map();
    }

    const grouped = await this.prisma.ubicacion.groupBy({
      by: ['idBodega'],
      where: {
        idBodega: { in: idBodegas },
        estaActiva: true,
        estadoSlot: EstadoSlot.libre,
        tipoUbicacion: { esAlmacenamiento: true },
      },
      _count: { _all: true },
    });

    return new Map(grouped.map((row) => [row.idBodega, row._count._all]));
  }

  resolveSlotsLibres(
    bodega: BodegaDestinoRecord,
    libresEnUbicaciones: number,
  ): number {
    if (libresEnUbicaciones > 0) {
      return libresEnUbicaciones;
    }

    if (bodega.tipo === BodegaTipo.externa) {
      return bodega.capacidadSlots ?? 1;
    }

    return 0;
  }
}
