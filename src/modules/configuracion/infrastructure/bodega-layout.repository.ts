import { Injectable } from '@nestjs/common';
import { BodegaTipo, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  LAYOUT_TIPO_ALMACEN,
  LAYOUT_TIPO_INGRESO,
  LAYOUT_ZONA_GENERAL,
  formatSlotCodigo,
} from '../constants/warehouse-layout.constants';
import type { BootstrapLayoutResult } from '../interfaces/bodega-layout.interfaces';

export interface BodegaLayoutRecord {
  idBodega: string;
  codigoCuenta: string;
  tipo: BodegaTipo;
  capacidadSlots: number | null;
  estaActiva: boolean;
}

@Injectable()
export class BodegaLayoutRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBodega(idBodega: string): Promise<BodegaLayoutRecord | null> {
    return this.prisma.bodega.findUnique({
      where: { idBodega },
      select: {
        idBodega: true,
        codigoCuenta: true,
        tipo: true,
        capacidadSlots: true,
        estaActiva: true,
      },
    });
  }

  countUbicaciones(idBodega: string): Promise<number> {
    return this.prisma.ubicacion.count({ where: { idBodega } });
  }

  bootstrapLayout(
    bodega: BodegaLayoutRecord,
    capacidadSlots: number,
  ): Promise<BootstrapLayoutResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.tipoUbicacion.create({
        data: {
          codigoCuenta: bodega.codigoCuenta,
          idBodega: bodega.idBodega,
          codigo: LAYOUT_TIPO_INGRESO.codigo,
          nombre: LAYOUT_TIPO_INGRESO.nombre,
          esRecepcion: LAYOUT_TIPO_INGRESO.esRecepcion,
          esAlmacenamiento: LAYOUT_TIPO_INGRESO.esAlmacenamiento,
          esPicking: LAYOUT_TIPO_INGRESO.esPicking,
        },
      });

      const tipoAlmacen = await tx.tipoUbicacion.create({
        data: {
          codigoCuenta: bodega.codigoCuenta,
          idBodega: bodega.idBodega,
          codigo: LAYOUT_TIPO_ALMACEN.codigo,
          nombre: LAYOUT_TIPO_ALMACEN.nombre,
          esRecepcion: LAYOUT_TIPO_ALMACEN.esRecepcion,
          esAlmacenamiento: LAYOUT_TIPO_ALMACEN.esAlmacenamiento,
          esPicking: LAYOUT_TIPO_ALMACEN.esPicking,
        },
      });

      const zona = await tx.zona.create({
        data: {
          codigoCuenta: bodega.codigoCuenta,
          idBodega: bodega.idBodega,
          codigo: LAYOUT_ZONA_GENERAL.codigo,
          nombre: LAYOUT_ZONA_GENERAL.nombre,
        },
      });

      const ubicacionesData: Prisma.UbicacionCreateManyInput[] = Array.from(
        { length: capacidadSlots },
        (_, index) => ({
          codigoCuenta: bodega.codigoCuenta,
          idBodega: bodega.idBodega,
          idZona: zona.idZona,
          idTipoUbicacion: tipoAlmacen.idTipoUbicacion,
          codigo: formatSlotCodigo(index + 1, capacidadSlots),
        }),
      );

      const { count: ubicacionesCreadas } = await tx.ubicacion.createMany({
        data: ubicacionesData,
      });

      return {
        idBodega: bodega.idBodega,
        codigoCuenta: bodega.codigoCuenta,
        capacidadSlots,
        tiposUbicacionCreados: 2,
        zonasCreadas: 1,
        ubicacionesCreadas,
      };
    });
  }
}
