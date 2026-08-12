import { Injectable } from '@nestjs/common';
import { BodegaTipo, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
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
  /** null = public; emp_* para schema-per-empresa. */
  schemaName: string | null;
}

type TipoUbicacionRow = {
  idTipoUbicacion: string;
  codigo: string;
  esRecepcion: boolean;
  esPicking: boolean;
};

type ZonaRow = {
  idZona: string;
  codigo: string;
};

@Injectable()
export class BodegaLayoutRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schemaLocator: TenantSchemaLocator,
  ) {}

  async findBodega(idBodega: string): Promise<BodegaLayoutRecord | null> {
    const located = await this.schemaLocator.findBodegaById(idBodega);
    if (!located) return null;

    return {
      idBodega: located.idBodega,
      codigoCuenta: located.codigoCuenta,
      tipo: located.tipo as BodegaTipo,
      capacidadSlots: located.capacidadSlots,
      estaActiva: located.estaActiva,
      schemaName: located.schemaName,
    };
  }

  countUbicaciones(
    idBodega: string,
    schemaName?: string | null,
  ): Promise<number> {
    const schema = this.schemaLocator.assertSafeSchemaIdent(
      schemaName ?? 'public',
    );
    return this.prisma
      .$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT count(*)::bigint AS count
         FROM ${schema}.ubicacion
         WHERE id_bodega = $1::uuid`,
        idBodega,
      )
      .then((rows) => Number(rows[0]?.count ?? 0));
  }

  /**
   * Transacción con search_path tenant (triggers layout leen "bodega" sin
   * calificar) + escrituras SQL calificadas (Prisma cae en public.*).
   */
  private async withTenantLayoutTx<T>(
    schemaName: string | null,
    fn: (
      tx: Prisma.TransactionClient,
      schema: string,
    ) => Promise<T>,
  ): Promise<T> {
    const schema = this.schemaLocator.assertSafeSchemaIdent(
      schemaName ?? 'public',
    );
    const searchPath =
      schema === 'public'
        ? 'public,mateo_support'
        : `${schema},public,mateo_support`;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('search_path', $1, true)`,
        searchPath,
      );
      return fn(tx, schema);
    });
  }

  bootstrapLayout(
    bodega: BodegaLayoutRecord,
    capacidadSlots: number,
  ): Promise<BootstrapLayoutResult> {
    return this.withTenantLayoutTx(bodega.schemaName, async (tx, schema) => {
      const tipoIngreso = await this.insertTipoUbicacion(
        tx,
        schema,
        this.tipoIngresoData(bodega),
      );
      const tipoAlmacen = await this.insertTipoUbicacion(
        tx,
        schema,
        this.tipoAlmacenData(bodega),
      );
      const tipoSalida = await this.insertTipoUbicacion(
        tx,
        schema,
        this.tipoSalidaData(bodega),
      );
      const tipoProcesamiento = await this.insertTipoUbicacion(
        tx,
        schema,
        this.tipoProcesamientoData(bodega),
      );

      const zonaIngreso = await this.insertZona(
        tx,
        schema,
        this.zonaData(bodega, LAYOUT_ZONA_INGRESO),
      );
      const zonaAlmacen = await this.insertZona(
        tx,
        schema,
        this.zonaData(bodega, LAYOUT_ZONA_ALMACEN),
      );
      const zonaSalida = await this.insertZona(
        tx,
        schema,
        this.zonaData(bodega, LAYOUT_ZONA_SALIDA),
      );
      const zonaProcesamiento = await this.insertZona(
        tx,
        schema,
        this.zonaData(bodega, LAYOUT_ZONA_PROCESAMIENTO),
      );

      const ubicacionRows = [
        ...this.buildIngresoUbicaciones(
          bodega,
          tipoIngreso.idTipoUbicacion,
          zonaIngreso.idZona,
        ),
        ...Array.from({ length: capacidadSlots }, (_, index) => ({
          codigoCuenta: bodega.codigoCuenta,
          idBodega: bodega.idBodega,
          idZona: zonaAlmacen.idZona,
          idTipoUbicacion: tipoAlmacen.idTipoUbicacion,
          codigo: formatSlotCodigo(index + 1, capacidadSlots),
        })),
        ...this.buildSalidaUbicaciones(
          bodega,
          tipoSalida.idTipoUbicacion,
          zonaSalida.idZona,
        ),
        ...this.buildProcesamientoUbicaciones(
          bodega,
          tipoProcesamiento.idTipoUbicacion,
          zonaProcesamiento.idZona,
        ),
      ];

      const ubicacionesCreadas = await this.insertUbicaciones(
        tx,
        schema,
        ubicacionRows,
      );

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
    return this.withTenantLayoutTx(bodega.schemaName, async (tx, schema) => {
      let tiposUbicacionCreados = 0;
      let zonasCreadas = 0;
      let ubicacionesIngresoCreadas = 0;
      let ubicacionesSalidaCreadas = 0;
      let ubicacionesProcesamientoCreadas = 0;

      const tipos = await this.listTiposUbicacion(tx, schema, bodega.idBodega);

      const tipoIngreso = await this.ensureTipoUbicacionSql(
        tx,
        schema,
        bodega,
        tipos,
        LAYOUT_TIPO_INGRESO.codigo,
        () => this.tipoIngresoData(bodega),
        () => {
          tiposUbicacionCreados += 1;
        },
      );

      const tipoSalida = await this.ensureTipoUbicacionSql(
        tx,
        schema,
        bodega,
        tipos,
        LAYOUT_TIPO_SALIDA.codigo,
        () => this.tipoSalidaData(bodega),
        () => {
          tiposUbicacionCreados += 1;
        },
      );

      const tipoProcesamiento = await this.ensureTipoUbicacionSql(
        tx,
        schema,
        bodega,
        tipos,
        LAYOUT_TIPO_PROCESAMIENTO.codigo,
        () => this.tipoProcesamientoData(bodega),
        () => {
          tiposUbicacionCreados += 1;
        },
      );

      const zonaIngreso = await this.ensureZonaSql(
        tx,
        schema,
        bodega,
        LAYOUT_ZONA_INGRESO,
        () => {
          zonasCreadas += 1;
        },
      );

      const zonaSalida = await this.ensureZonaSql(
        tx,
        schema,
        bodega,
        LAYOUT_ZONA_SALIDA,
        () => {
          zonasCreadas += 1;
        },
      );

      const zonaProcesamiento = await this.ensureZonaSql(
        tx,
        schema,
        bodega,
        LAYOUT_ZONA_PROCESAMIENTO,
        () => {
          zonasCreadas += 1;
        },
      );

      const ingresoExistentes = await this.countUbicacionesByTipoFlag(
        tx,
        schema,
        bodega.idBodega,
        'es_recepcion',
      );
      if (ingresoExistentes === 0) {
        ubicacionesIngresoCreadas = await this.insertUbicaciones(
          tx,
          schema,
          this.buildIngresoUbicaciones(
            bodega,
            tipoIngreso.idTipoUbicacion,
            zonaIngreso.idZona,
          ),
        );
      }

      const salidaExistentes = await this.countUbicacionesByTipoFlag(
        tx,
        schema,
        bodega.idBodega,
        'es_picking',
      );
      if (salidaExistentes === 0) {
        ubicacionesSalidaCreadas = await this.insertUbicaciones(
          tx,
          schema,
          this.buildSalidaUbicaciones(
            bodega,
            tipoSalida.idTipoUbicacion,
            zonaSalida.idZona,
          ),
        );
      }

      const procesamientoExistentes = await this.countUbicacionesByTipoCodigo(
        tx,
        schema,
        bodega.idBodega,
        LAYOUT_TIPO_PROCESAMIENTO.codigo,
      );
      if (procesamientoExistentes === 0) {
        ubicacionesProcesamientoCreadas = await this.insertUbicaciones(
          tx,
          schema,
          this.buildProcesamientoUbicaciones(
            bodega,
            tipoProcesamiento.idTipoUbicacion,
            zonaProcesamiento.idZona,
          ),
        );
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

  private async insertTipoUbicacion(
    tx: Prisma.TransactionClient,
    schema: string,
    data: Prisma.TipoUbicacionUncheckedCreateInput,
  ): Promise<{ idTipoUbicacion: string }> {
    const rows = await tx.$queryRawUnsafe<Array<{ idTipoUbicacion: string }>>(
      `INSERT INTO ${schema}.tipo_ubicacion (
         codigo_cuenta, id_bodega, codigo, nombre,
         es_recepcion, es_almacenamiento, es_picking, esta_activa
       ) VALUES (
         $1, $2::uuid, $3, $4, $5, $6, $7, true
       )
       RETURNING id_tipo_ubicacion AS "idTipoUbicacion"`,
      data.codigoCuenta,
      data.idBodega,
      data.codigo,
      data.nombre,
      data.esRecepcion ?? false,
      data.esAlmacenamiento ?? true,
      data.esPicking ?? false,
    );
    const row = rows[0];
    if (!row) {
      throw new Error(`No se pudo insertar tipo_ubicacion en ${schema}`);
    }
    return row;
  }

  private async insertZona(
    tx: Prisma.TransactionClient,
    schema: string,
    data: Prisma.ZonaUncheckedCreateInput,
  ): Promise<{ idZona: string }> {
    const rows = await tx.$queryRawUnsafe<Array<{ idZona: string }>>(
      `INSERT INTO ${schema}.zona (
         codigo_cuenta, id_bodega, codigo, nombre, esta_activa
       ) VALUES (
         $1, $2::uuid, $3, $4, true
       )
       RETURNING id_zona AS "idZona"`,
      data.codigoCuenta,
      data.idBodega,
      data.codigo,
      data.nombre,
    );
    const row = rows[0];
    if (!row) {
      throw new Error(`No se pudo insertar zona en ${schema}`);
    }
    return row;
  }

  private async insertUbicaciones(
    tx: Prisma.TransactionClient,
    schema: string,
    rows: Array<{
      codigoCuenta: string;
      idBodega: string;
      idZona: string;
      idTipoUbicacion: string;
      codigo: string;
    }>,
  ): Promise<number> {
    if (rows.length === 0) return 0;

    // unnest arrays: una sola statement evita N round-trips.
    const codigosCuenta = rows.map((r) => r.codigoCuenta);
    const idsBodega = rows.map((r) => r.idBodega);
    const idsZona = rows.map((r) => r.idZona);
    const idsTipo = rows.map((r) => r.idTipoUbicacion);
    const codigos = rows.map((r) => r.codigo);

    const result = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `WITH inserted AS (
         INSERT INTO ${schema}.ubicacion (
           codigo_cuenta, id_bodega, id_zona, id_tipo_ubicacion, codigo, esta_activa
         )
         SELECT
           c.codigo_cuenta,
           c.id_bodega::uuid,
           c.id_zona::uuid,
           c.id_tipo_ubicacion::uuid,
           c.codigo,
           true
         FROM unnest(
           $1::text[],
           $2::text[],
           $3::text[],
           $4::text[],
           $5::text[]
         ) AS c(codigo_cuenta, id_bodega, id_zona, id_tipo_ubicacion, codigo)
         RETURNING 1
       )
       SELECT count(*)::bigint AS count FROM inserted`,
      codigosCuenta,
      idsBodega,
      idsZona,
      idsTipo,
      codigos,
    );

    return Number(result[0]?.count ?? 0);
  }

  private async listTiposUbicacion(
    tx: Prisma.TransactionClient,
    schema: string,
    idBodega: string,
  ): Promise<TipoUbicacionRow[]> {
    return tx.$queryRawUnsafe<TipoUbicacionRow[]>(
      `SELECT id_tipo_ubicacion AS "idTipoUbicacion",
              codigo,
              es_recepcion AS "esRecepcion",
              es_picking AS "esPicking"
       FROM ${schema}.tipo_ubicacion
       WHERE id_bodega = $1::uuid`,
      idBodega,
    );
  }

  private async countUbicacionesByTipoFlag(
    tx: Prisma.TransactionClient,
    schema: string,
    idBodega: string,
    flagColumn: 'es_recepcion' | 'es_picking',
  ): Promise<number> {
    const rows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count
       FROM ${schema}.ubicacion u
       JOIN ${schema}.tipo_ubicacion t
         ON t.id_tipo_ubicacion = u.id_tipo_ubicacion
       WHERE u.id_bodega = $1::uuid
         AND t.${flagColumn} = true`,
      idBodega,
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async countUbicacionesByTipoCodigo(
    tx: Prisma.TransactionClient,
    schema: string,
    idBodega: string,
    codigoTipo: string,
  ): Promise<number> {
    const rows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count
       FROM ${schema}.ubicacion u
       JOIN ${schema}.tipo_ubicacion t
         ON t.id_tipo_ubicacion = u.id_tipo_ubicacion
       WHERE u.id_bodega = $1::uuid
         AND t.codigo = $2`,
      idBodega,
      codigoTipo,
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async ensureTipoUbicacionSql(
    tx: Prisma.TransactionClient,
    schema: string,
    _bodega: BodegaLayoutRecord,
    tipos: TipoUbicacionRow[],
    codigo: string,
    createData: () => Prisma.TipoUbicacionUncheckedCreateInput,
    onCreated: () => void,
  ): Promise<{ idTipoUbicacion: string }> {
    const existente = tipos.find((tipo) => tipo.codigo === codigo);
    if (existente) {
      return { idTipoUbicacion: existente.idTipoUbicacion };
    }

    const creado = await this.insertTipoUbicacion(tx, schema, createData());
    onCreated();
    return creado;
  }

  private async ensureZonaSql(
    tx: Prisma.TransactionClient,
    schema: string,
    bodega: BodegaLayoutRecord,
    zona: { codigo: string; nombre: string },
    onCreated: () => void,
  ): Promise<{ idZona: string }> {
    const existentes = await tx.$queryRawUnsafe<ZonaRow[]>(
      `SELECT id_zona AS "idZona", codigo
       FROM ${schema}.zona
       WHERE id_bodega = $1::uuid AND codigo = $2
       LIMIT 1`,
      bodega.idBodega,
      zona.codigo,
    );

    if (existentes[0]) {
      return { idZona: existentes[0].idZona };
    }

    const creada = await this.insertZona(
      tx,
      schema,
      this.zonaData(bodega, zona),
    );
    onCreated();
    return creada;
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
  ) {
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
  ) {
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
  ) {
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
}
