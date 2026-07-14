import { Injectable } from '@nestjs/common';
import { BodegaTipo, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  LAYOUT_INGRESO_SLOTS,
  LAYOUT_PROCESAMIENTO_SLOTS,
  LAYOUT_SALIDA_SLOTS,
  LAYOUT_TIPO_ALMACEN,
  LAYOUT_TIPO_INGRESO,
  LAYOUT_TIPO_PROCESAMIENTO,
  LAYOUT_TIPO_SALIDA,
  LAYOUT_ZONA_ALMACEN,
  LAYOUT_ZONA_INGRESO,
  LAYOUT_ZONA_PROCESAMIENTO,
  LAYOUT_ZONA_SALIDA,
  formatSlotCodigo,
  formatZoneSlotCodigo,
  LAYOUT_INGRESO_PREFIX,
  LAYOUT_PROCESAMIENTO_PREFIX,
  LAYOUT_SALIDA_PREFIX,
} from '../constants/warehouse-layout.constants';
import type {
  BootstrapLayoutResult,
  EnsureOperationalZonesResult,
} from '../interfaces/bodega-layout.interfaces';

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
      const tipoIngreso = await tx.tipoUbicacion.create({
        data: this.tipoIngresoData(bodega),
      });

      const tipoAlmacen = await tx.tipoUbicacion.create({
        data: this.tipoAlmacenData(bodega),
      });

      const tipoSalida = await tx.tipoUbicacion.create({
        data: this.tipoSalidaData(bodega),
      });

      const tipoProcesamiento = await tx.tipoUbicacion.create({
        data: this.tipoProcesamientoData(bodega),
      });

      const zonaIngreso = await tx.zona.create({
        data: this.zonaData(bodega, LAYOUT_ZONA_INGRESO),
      });

      const zonaAlmacen = await tx.zona.create({
        data: this.zonaData(bodega, LAYOUT_ZONA_ALMACEN),
      });

      const zonaSalida = await tx.zona.create({
        data: this.zonaData(bodega, LAYOUT_ZONA_SALIDA),
      });

      const zonaProcesamiento = await tx.zona.create({
        data: this.zonaData(bodega, LAYOUT_ZONA_PROCESAMIENTO),
      });

      const ingresoRows = this.buildIngresoUbicaciones(
        bodega,
        tipoIngreso.idTipoUbicacion,
        zonaIngreso.idZona,
      );

      const almacenRows = Array.from(
        { length: capacidadSlots },
        (_, index) => ({
          codigoCuenta: bodega.codigoCuenta,
          idBodega: bodega.idBodega,
          idZona: zonaAlmacen.idZona,
          idTipoUbicacion: tipoAlmacen.idTipoUbicacion,
          codigo: formatSlotCodigo(index + 1, capacidadSlots),
        }),
      );

      const salidaRows = this.buildSalidaUbicaciones(
        bodega,
        tipoSalida.idTipoUbicacion,
        zonaSalida.idZona,
      );

      const procesamientoRows = this.buildProcesamientoUbicaciones(
        bodega,
        tipoProcesamiento.idTipoUbicacion,
        zonaProcesamiento.idZona,
      );

      const { count: ubicacionesCreadas } = await tx.ubicacion.createMany({
        data: [
          ...ingresoRows,
          ...almacenRows,
          ...salidaRows,
          ...procesamientoRows,
        ],
      });

      return {
        idBodega: bodega.idBodega,
        codigoCuenta: bodega.codigoCuenta,
        capacidadSlots,
        tiposUbicacionCreados: 4,
        zonasCreadas: 4,
        ubicacionesCreadas,
      };
    });
  }

  ensureOperationalZones(
    bodega: BodegaLayoutRecord,
  ): Promise<EnsureOperationalZonesResult> {
    return this.prisma.$transaction(async (tx) => {
      let tiposUbicacionCreados = 0;
      let zonasCreadas = 0;
      let ubicacionesIngresoCreadas = 0;
      let ubicacionesSalidaCreadas = 0;
      let ubicacionesProcesamientoCreadas = 0;

      const tipos = await tx.tipoUbicacion.findMany({
        where: { idBodega: bodega.idBodega },
      });

      const tipoIngreso = await this.ensureTipoUbicacion(
        tx,
        bodega,
        tipos,
        LAYOUT_TIPO_INGRESO.codigo,
        () => this.tipoIngresoData(bodega),
        () => {
          tiposUbicacionCreados += 1;
        },
      );

      const tipoSalida = await this.ensureTipoUbicacion(
        tx,
        bodega,
        tipos,
        LAYOUT_TIPO_SALIDA.codigo,
        () => this.tipoSalidaData(bodega),
        () => {
          tiposUbicacionCreados += 1;
        },
      );

      const tipoProcesamiento = await this.ensureTipoUbicacion(
        tx,
        bodega,
        tipos,
        LAYOUT_TIPO_PROCESAMIENTO.codigo,
        () => this.tipoProcesamientoData(bodega),
        () => {
          tiposUbicacionCreados += 1;
        },
      );

      const zonaIngreso = await this.ensureZona(
        tx,
        bodega,
        LAYOUT_ZONA_INGRESO,
        () => {
          zonasCreadas += 1;
        },
      );

      const zonaSalida = await this.ensureZona(
        tx,
        bodega,
        LAYOUT_ZONA_SALIDA,
        () => {
          zonasCreadas += 1;
        },
      );

      const zonaProcesamiento = await this.ensureZona(
        tx,
        bodega,
        LAYOUT_ZONA_PROCESAMIENTO,
        () => {
          zonasCreadas += 1;
        },
      );

      const ingresoExistentes = await tx.ubicacion.count({
        where: {
          idBodega: bodega.idBodega,
          tipoUbicacion: { esRecepcion: true },
        },
      });

      if (ingresoExistentes === 0) {
        const rows = this.buildIngresoUbicaciones(
          bodega,
          tipoIngreso.idTipoUbicacion,
          zonaIngreso.idZona,
        );
        const created = await tx.ubicacion.createMany({ data: rows });
        ubicacionesIngresoCreadas = created.count;
      }

      const salidaExistentes = await tx.ubicacion.count({
        where: {
          idBodega: bodega.idBodega,
          tipoUbicacion: { esPicking: true },
        },
      });

      if (salidaExistentes === 0) {
        const rows = this.buildSalidaUbicaciones(
          bodega,
          tipoSalida.idTipoUbicacion,
          zonaSalida.idZona,
        );
        const created = await tx.ubicacion.createMany({ data: rows });
        ubicacionesSalidaCreadas = created.count;
      }

      const procesamientoExistentes = await tx.ubicacion.count({
        where: {
          idBodega: bodega.idBodega,
          tipoUbicacion: { codigo: LAYOUT_TIPO_PROCESAMIENTO.codigo },
        },
      });

      if (procesamientoExistentes === 0) {
        const rows = this.buildProcesamientoUbicaciones(
          bodega,
          tipoProcesamiento.idTipoUbicacion,
          zonaProcesamiento.idZona,
        );
        const created = await tx.ubicacion.createMany({ data: rows });
        ubicacionesProcesamientoCreadas = created.count;
      }

      return {
        idBodega: bodega.idBodega,
        codigoCuenta: bodega.codigoCuenta,
        tiposUbicacionCreados,
        zonasCreadas,
        ubicacionesIngresoCreadas,
        ubicacionesSalidaCreadas,
        ubicacionesProcesamientoCreadas,
      };
    });
  }

  private tipoIngresoData(
    bodega: BodegaLayoutRecord,
  ): Prisma.TipoUbicacionUncheckedCreateInput {
    return {
      codigoCuenta: bodega.codigoCuenta,
      idBodega: bodega.idBodega,
      codigo: LAYOUT_TIPO_INGRESO.codigo,
      nombre: LAYOUT_TIPO_INGRESO.nombre,
      esRecepcion: LAYOUT_TIPO_INGRESO.esRecepcion,
      esAlmacenamiento: LAYOUT_TIPO_INGRESO.esAlmacenamiento,
      esPicking: LAYOUT_TIPO_INGRESO.esPicking,
    };
  }

  private tipoAlmacenData(
    bodega: BodegaLayoutRecord,
  ): Prisma.TipoUbicacionUncheckedCreateInput {
    return {
      codigoCuenta: bodega.codigoCuenta,
      idBodega: bodega.idBodega,
      codigo: LAYOUT_TIPO_ALMACEN.codigo,
      nombre: LAYOUT_TIPO_ALMACEN.nombre,
      esRecepcion: LAYOUT_TIPO_ALMACEN.esRecepcion,
      esAlmacenamiento: LAYOUT_TIPO_ALMACEN.esAlmacenamiento,
      esPicking: LAYOUT_TIPO_ALMACEN.esPicking,
    };
  }

  private tipoSalidaData(
    bodega: BodegaLayoutRecord,
  ): Prisma.TipoUbicacionUncheckedCreateInput {
    return {
      codigoCuenta: bodega.codigoCuenta,
      idBodega: bodega.idBodega,
      codigo: LAYOUT_TIPO_SALIDA.codigo,
      nombre: LAYOUT_TIPO_SALIDA.nombre,
      esRecepcion: LAYOUT_TIPO_SALIDA.esRecepcion,
      esAlmacenamiento: LAYOUT_TIPO_SALIDA.esAlmacenamiento,
      esPicking: LAYOUT_TIPO_SALIDA.esPicking,
    };
  }

  private tipoProcesamientoData(
    bodega: BodegaLayoutRecord,
  ): Prisma.TipoUbicacionUncheckedCreateInput {
    return {
      codigoCuenta: bodega.codigoCuenta,
      idBodega: bodega.idBodega,
      codigo: LAYOUT_TIPO_PROCESAMIENTO.codigo,
      nombre: LAYOUT_TIPO_PROCESAMIENTO.nombre,
      esRecepcion: LAYOUT_TIPO_PROCESAMIENTO.esRecepcion,
      esAlmacenamiento: LAYOUT_TIPO_PROCESAMIENTO.esAlmacenamiento,
      esPicking: LAYOUT_TIPO_PROCESAMIENTO.esPicking,
    };
  }

  private zonaData(
    bodega: BodegaLayoutRecord,
    zona: { codigo: string; nombre: string },
  ): Prisma.ZonaUncheckedCreateInput {
    return {
      codigoCuenta: bodega.codigoCuenta,
      idBodega: bodega.idBodega,
      codigo: zona.codigo,
      nombre: zona.nombre,
    };
  }

  private buildIngresoUbicaciones(
    bodega: BodegaLayoutRecord,
    idTipoUbicacion: string,
    idZona: string,
  ): Prisma.UbicacionCreateManyInput[] {
    return Array.from({ length: LAYOUT_INGRESO_SLOTS }, (_, index) => ({
      codigoCuenta: bodega.codigoCuenta,
      idBodega: bodega.idBodega,
      idZona,
      idTipoUbicacion,
      codigo: formatZoneSlotCodigo(
        LAYOUT_INGRESO_PREFIX,
        index + 1,
        LAYOUT_INGRESO_SLOTS,
      ),
    }));
  }

  private buildSalidaUbicaciones(
    bodega: BodegaLayoutRecord,
    idTipoUbicacion: string,
    idZona: string,
  ): Prisma.UbicacionCreateManyInput[] {
    return Array.from({ length: LAYOUT_SALIDA_SLOTS }, (_, index) => ({
      codigoCuenta: bodega.codigoCuenta,
      idBodega: bodega.idBodega,
      idZona,
      idTipoUbicacion,
      codigo: formatZoneSlotCodigo(
        LAYOUT_SALIDA_PREFIX,
        index + 1,
        LAYOUT_SALIDA_SLOTS,
      ),
    }));
  }

  private buildProcesamientoUbicaciones(
    bodega: BodegaLayoutRecord,
    idTipoUbicacion: string,
    idZona: string,
  ): Prisma.UbicacionCreateManyInput[] {
    return Array.from({ length: LAYOUT_PROCESAMIENTO_SLOTS }, (_, index) => ({
      codigoCuenta: bodega.codigoCuenta,
      idBodega: bodega.idBodega,
      idZona,
      idTipoUbicacion,
      codigo: formatZoneSlotCodigo(
        LAYOUT_PROCESAMIENTO_PREFIX,
        index + 1,
        LAYOUT_PROCESAMIENTO_SLOTS,
      ),
    }));
  }

  private async ensureTipoUbicacion(
    tx: Prisma.TransactionClient,
    bodega: BodegaLayoutRecord,
    tipos: Array<{ idTipoUbicacion: string; codigo: string }>,
    codigo: string,
    createData: () => Prisma.TipoUbicacionUncheckedCreateInput,
    onCreated: () => void,
  ) {
    const existente = tipos.find((tipo) => tipo.codigo === codigo);
    if (existente) {
      return existente;
    }

    const creado = await tx.tipoUbicacion.create({ data: createData() });
    onCreated();
    return creado;
  }

  private async ensureZona(
    tx: Prisma.TransactionClient,
    bodega: BodegaLayoutRecord,
    zona: { codigo: string; nombre: string },
    onCreated: () => void,
  ) {
    const existente = await tx.zona.findFirst({
      where: {
        idBodega: bodega.idBodega,
        codigo: zona.codigo,
      },
    });

    if (existente) {
      return existente;
    }

    const creada = await tx.zona.create({
      data: this.zonaData(bodega, zona),
    });
    onCreated();
    return creada;
  }
}
