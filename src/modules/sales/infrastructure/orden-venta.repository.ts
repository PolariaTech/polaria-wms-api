import { Injectable } from '@nestjs/common';
import { EstadoOrdenVenta, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
import { OrdenTrabajoRepository } from '../../operations/infrastructure/orden-trabajo.repository';
import type { FlujoOrdenTrabajo } from '../../operations/interfaces/operations.interfaces';
import { TIPO_REFERENCIA_ORDEN_VENTA } from '../constants/orden-venta.constants';
import type {
  OrdenVentaEmitirResponse,
  StockAllocation,
} from '../interfaces/orden-venta.interfaces';

const _ordenInclude = {
  lineas: {
    orderBy: { idLineaOrdenVenta: 'asc' as const },
    include: {
      producto: {
        select: {
          idProducto: true,
          sku: true,
          descripcion: true,
          estaActivo: true,
          metadatosCatalogo: true,
        },
      },
    },
  },
  comprador: { select: { idComprador: true, nombre: true, estaActivo: true } },
  cliente: { select: { idCliente: true, nombre: true, estaActivo: true } },
  bodega: {
    select: {
      idBodega: true,
      nombre: true,
      estaActiva: true,
      codigoCuenta: true,
    },
  },
  bodegaDestino: { select: { idBodega: true, nombre: true, estaActiva: true } },
} satisfies Prisma.OrdenVentaInclude;

export type OrdenVentaWithRelations = Prisma.OrdenVentaGetPayload<{
  include: typeof _ordenInclude;
}>;

type SqlClient = Pick<
  Prisma.TransactionClient,
  '$queryRawUnsafe' | '$executeRawUnsafe'
>;

type OvHeaderRow = {
  idOrdenVenta: string;
  codigoCuenta: string;
  idBodega: string;
  idCliente: string;
  idComprador: string | null;
  idPlanta: string | null;
  idCreador: string | null;
  idBodegaDestino: string | null;
  codigo: string;
  estado: EstadoOrdenVenta;
  fechaPedido: Date | string;
  observaciones: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  clienteNombre: string;
  clienteActivo: boolean;
  compradorNombre: string | null;
  compradorActivo: boolean | null;
  bodegaNombre: string;
  bodegaActiva: boolean;
  bodegaCodigoCuenta: string;
  bodegaDestinoNombre: string | null;
  bodegaDestinoActiva: boolean | null;
};

type OvLineaRow = {
  idLineaOrdenVenta: string;
  idOrdenVenta: string;
  idProducto: string;
  cantidadPedida: Prisma.Decimal | string | number;
  cantidadDespachada: Prisma.Decimal | string | number;
  sku: string;
  descripcion: string;
  estaActivo: boolean;
  metadatosCatalogo: Prisma.JsonValue | null;
};

type ListWhereParsed = {
  codigoCuenta?: string;
  idBodegas?: string[];
  estado?: string;
};

@Injectable()
export class OrdenVentaRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordenTrabajoRepository: OrdenTrabajoRepository,
    private readonly schemaLocator: TenantSchemaLocator,
  ) {}

  /**
   * Prisma califica tablas a public.* aunque el pool tenga search_path tenant.
   * Transacción con search_path (triggers) + SQL calificado ${schema}.tabla.
   */
  private async withTenantTx<T>(
    schemaName: string | null | undefined,
    fn: (tx: Prisma.TransactionClient, schema: string) => Promise<T>,
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

  async findById(
    idOrdenVenta: string,
    schemaName?: string | null,
  ): Promise<OrdenVentaWithRelations | null> {
    const schemas = await this.schemasToSearch(schemaName);
    for (const schema of schemas) {
      const found = await this.loadOrdenVenta(
        this.prisma,
        schema,
        idOrdenVenta,
      );
      if (found) return found;
    }
    return null;
  }

  async list(
    where: Prisma.OrdenVentaWhereInput,
    schemaName?: string | null,
  ): Promise<OrdenVentaWithRelations[]> {
    const schema = this.schemaLocator.assertSafeSchemaIdent(
      schemaName ?? 'public',
    );
    return this.loadOrdenes(this.prisma, schema, this.parseListWhere(where));
  }

  async emitir(
    orden: OrdenVentaWithRelations,
    idUsuario: string,
    schemaName?: string | null,
  ): Promise<OrdenVentaEmitirResponse> {
    return this.withTenantTx(schemaName, async (tx, schema) => {
      const locked = await tx.$queryRawUnsafe<Array<{ idOrdenVenta: string }>>(
        `UPDATE ${schema}.orden_venta
         SET estado = 'confirmada',
             updated_at = now()
         WHERE id_orden_venta = $1::uuid
           AND estado = 'borrador'
         RETURNING id_orden_venta AS "idOrdenVenta"`,
        orden.idOrdenVenta,
      );

      if (locked.length === 0) {
        throw new Error('OV_ESTADO_INVALIDO');
      }

      const tipoFlujo = this.resolveTipoFlujo(orden);
      const idUbicacionDestino =
        (await this.resolveUbicacionDestino(tx, schema, orden, tipoFlujo)) ??
        undefined;

      const allocations: StockAllocation[] = [];

      for (const linea of orden.lineas) {
        const pendiente = linea.cantidadPedida;
        const chunks = await this.allocateFifo(
          tx,
          schema,
          orden.codigoCuenta,
          orden.idBodega,
          linea.idProducto,
          pendiente,
        );
        allocations.push(...chunks);

        for (const chunk of chunks) {
          await tx.$executeRawUnsafe(
            `UPDATE ${schema}.warehouse_state
             SET cantidad_reservada = cantidad_reservada + $2::numeric,
                 version = version + 1,
                 updated_at = now()
             WHERE id_warehouse_state = $1::uuid`,
            chunk.idWarehouseState,
            chunk.cantidad,
          );

          await tx.$executeRawUnsafe(
            `INSERT INTO ${schema}.movimiento_inventario (
               codigo_cuenta,
               id_bodega,
               id_ubicacion_origen,
               id_ubicacion_destino,
               id_producto,
               id_lote,
               cantidad,
               tipo_movimiento,
               id_usuario,
               id_referencia,
               tipo_referencia
             ) VALUES (
               $1,
               $2::uuid,
               $3::uuid,
               $4::uuid,
               $5::uuid,
               $6::uuid,
               $7::numeric,
               'reserva',
               $8::uuid,
               $9::uuid,
               $10
             )`,
            orden.codigoCuenta,
            orden.idBodega,
            chunk.idUbicacion,
            chunk.idUbicacion,
            chunk.idProducto,
            chunk.idLote,
            chunk.cantidad,
            idUsuario,
            orden.idOrdenVenta,
            TIPO_REFERENCIA_ORDEN_VENTA,
          );

          const observacionesOt = `OV ${orden.codigo}${
            orden.comprador ? ` · ${orden.comprador.nombre}` : ''
          }`;

          await this.ordenTrabajoRepository.createInTransaction(
            tx,
            {
              codigoCuenta: orden.codigoCuenta,
              idBodega: orden.idBodega,
              tipoFlujo,
              idUbicacionOrigen: chunk.idUbicacion,
              idUbicacionDestino,
              idLote: chunk.idLote ?? undefined,
              idProducto: linea.idProducto,
              cantidad: chunk.cantidad,
              idOrdenVenta: orden.idOrdenVenta,
              observaciones: observacionesOt,
            },
            idUsuario,
            { schemaName: schema },
          );
        }
      }

      const updated = await this.loadOrdenVenta(tx, schema, orden.idOrdenVenta);
      if (!updated) {
        throw new Error('OV_NOT_FOUND_AFTER_EMIT');
      }

      return this.toEmitirResponse(updated);
    });
  }

  private resolveTipoFlujo(orden: OrdenVentaWithRelations): FlujoOrdenTrabajo {
    if (orden.idBodegaDestino && orden.idBodegaDestino !== orden.idBodega) {
      return 'bodega_a_bodega';
    }
    return 'a_salida';
  }

  private async resolveUbicacionDestino(
    tx: SqlClient,
    schema: string,
    orden: OrdenVentaWithRelations,
    tipoFlujo: FlujoOrdenTrabajo,
  ): Promise<string | null> {
    if (tipoFlujo === 'bodega_a_bodega' && orden.idBodegaDestino) {
      const rows = await tx.$queryRawUnsafe<Array<{ idUbicacion: string }>>(
        `SELECT u.id_ubicacion AS "idUbicacion"
         FROM ${schema}.ubicacion u
         JOIN ${schema}.tipo_ubicacion t
           ON t.id_tipo_ubicacion = u.id_tipo_ubicacion
         WHERE u.id_bodega = $1::uuid
           AND u.esta_activa = true
           AND u.estado_slot = 'libre'
           AND t.es_almacenamiento = true
         ORDER BY u.codigo ASC
         LIMIT 1`,
        orden.idBodegaDestino,
      );

      return rows[0]?.idUbicacion ?? null;
    }

    const rows = await tx.$queryRawUnsafe<Array<{ idUbicacion: string }>>(
      `SELECT u.id_ubicacion AS "idUbicacion"
       FROM ${schema}.ubicacion u
       JOIN ${schema}.tipo_ubicacion t
         ON t.id_tipo_ubicacion = u.id_tipo_ubicacion
       WHERE u.id_bodega = $1::uuid
         AND u.codigo_cuenta = $2
         AND u.esta_activa = true
         AND u.estado_slot = 'libre'
         AND t.es_picking = true
       ORDER BY u.codigo ASC
       LIMIT 1`,
      orden.idBodega,
      orden.codigoCuenta,
    );

    return rows[0]?.idUbicacion ?? null;
  }

  private async allocateFifo(
    tx: SqlClient,
    schema: string,
    codigoCuenta: string,
    idBodega: string,
    idProducto: string,
    cantidadRequerida: Prisma.Decimal,
  ): Promise<StockAllocation[]> {
    const rows = await tx.$queryRawUnsafe<
      Array<{
        idWarehouseState: string;
        idUbicacion: string;
        idLote: string | null;
        idProducto: string;
        cantidad: Prisma.Decimal | string | number;
        cantidadReservada: Prisma.Decimal | string | number;
      }>
    >(
      `SELECT ws.id_warehouse_state AS "idWarehouseState",
              ws.id_ubicacion AS "idUbicacion",
              ws.id_lote AS "idLote",
              ws.id_producto AS "idProducto",
              ws.cantidad,
              ws.cantidad_reservada AS "cantidadReservada"
       FROM ${schema}.warehouse_state ws
       JOIN ${schema}.ubicacion u ON u.id_ubicacion = ws.id_ubicacion
       JOIN ${schema}.tipo_ubicacion t
         ON t.id_tipo_ubicacion = u.id_tipo_ubicacion
       LEFT JOIN ${schema}.lote l ON l.id_lote = ws.id_lote
       WHERE ws.codigo_cuenta = $1
         AND ws.id_bodega = $2::uuid
         AND ws.id_producto = $3::uuid
         AND u.esta_activa = true
         AND t.es_almacenamiento = true
       ORDER BY l.fecha_vencimiento ASC NULLS LAST, ws.updated_at ASC`,
      codigoCuenta,
      idBodega,
      idProducto,
    );

    let restante = this.toDecimal(cantidadRequerida);
    const allocations: StockAllocation[] = [];

    for (const row of rows) {
      const disponible = this.toDecimal(row.cantidad).sub(
        this.toDecimal(row.cantidadReservada),
      );
      if (disponible.lte(0)) {
        continue;
      }

      const tomar = disponible.lte(restante) ? disponible : restante;
      if (tomar.lte(0)) {
        continue;
      }

      allocations.push({
        idWarehouseState: row.idWarehouseState,
        idUbicacion: row.idUbicacion,
        idLote: row.idLote,
        idProducto: row.idProducto,
        cantidad: tomar.toNumber(),
      });

      restante = restante.sub(tomar);
      if (restante.lte(0)) {
        break;
      }
    }

    // Temporal: si falta stock, se emite igual con la reserva parcial (o sin reserva).
    return allocations;
  }

  async getDisponibleProducto(
    codigoCuenta: string,
    idBodega: string,
    idProducto: string,
    schemaName?: string | null,
  ): Promise<Prisma.Decimal> {
    const schema = this.schemaLocator.assertSafeSchemaIdent(
      schemaName ?? 'public',
    );
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        cantidad: Prisma.Decimal | string | number;
        cantidadReservada: Prisma.Decimal | string | number;
      }>
    >(
      `SELECT ws.cantidad,
              ws.cantidad_reservada AS "cantidadReservada"
       FROM ${schema}.warehouse_state ws
       JOIN ${schema}.ubicacion u ON u.id_ubicacion = ws.id_ubicacion
       JOIN ${schema}.tipo_ubicacion t
         ON t.id_tipo_ubicacion = u.id_tipo_ubicacion
       WHERE ws.codigo_cuenta = $1
         AND ws.id_bodega = $2::uuid
         AND ws.id_producto = $3::uuid
         AND u.esta_activa = true
         AND t.es_almacenamiento = true`,
      codigoCuenta,
      idBodega,
      idProducto,
    );

    return rows.reduce(
      (sum, row) =>
        sum.add(
          this.toDecimal(row.cantidad).sub(
            this.toDecimal(row.cantidadReservada),
          ),
        ),
      new Prisma.Decimal(0),
    );
  }

  toEmitirResponse(orden: OrdenVentaWithRelations): OrdenVentaEmitirResponse {
    const cantidadKg = orden.lineas.reduce(
      (sum, linea) => sum.add(linea.cantidadPedida),
      new Prisma.Decimal(0),
    );

    let total = new Prisma.Decimal(0);
    for (const linea of orden.lineas) {
      const precio = this.extractPrecio(linea.producto.metadatosCatalogo);
      total = total.add(precio.mul(linea.cantidadPedida));
    }

    const productosLabel =
      orden.lineas.length === 1
        ? '1 producto'
        : `${orden.lineas.length} productos`;

    const destino =
      orden.bodegaDestino?.nombre ?? orden.bodega.nombre ?? 'Salida interna';

    return {
      idOrdenVenta: orden.idOrdenVenta,
      venta: orden.codigo,
      cuenta: orden.codigoCuenta,
      comprador: orden.comprador?.nombre ?? orden.cliente.nombre,
      productos: productosLabel,
      cantidadKg: cantidadKg.toNumber(),
      total: total.toNumber(),
      estado: orden.estado,
      fecha: this.toDate(orden.fechaPedido).toISOString(),
      destino,
    };
  }

  private extractPrecio(metadatos: Prisma.JsonValue | null): Prisma.Decimal {
    if (
      !metadatos ||
      typeof metadatos !== 'object' ||
      Array.isArray(metadatos)
    ) {
      return new Prisma.Decimal(0);
    }

    const precio = (metadatos as { precio?: unknown }).precio;
    if (typeof precio === 'number' && Number.isFinite(precio)) {
      return new Prisma.Decimal(precio);
    }

    if (typeof precio === 'string' && precio.trim()) {
      return new Prisma.Decimal(precio);
    }

    return new Prisma.Decimal(0);
  }

  private async schemasToSearch(preferred?: string | null): Promise<string[]> {
    const ordered: string[] = [];
    const add = (value: string | null | undefined) => {
      const schema = (value ?? 'public').trim() || 'public';
      if (!ordered.includes(schema)) {
        ordered.push(this.schemaLocator.assertSafeSchemaIdent(schema));
      }
    };

    add(preferred);
    add('public');
    for (const schema of await this.schemaLocator.listTenantSchemaNames()) {
      add(schema);
    }
    return ordered;
  }

  private parseListWhere(where: Prisma.OrdenVentaWhereInput): ListWhereParsed {
    const parsed: ListWhereParsed = {};

    if (typeof where.codigoCuenta === 'string') {
      parsed.codigoCuenta = where.codigoCuenta;
    }

    if (typeof where.idBodega === 'string') {
      parsed.idBodegas = [where.idBodega];
    } else if (
      where.idBodega &&
      typeof where.idBodega === 'object' &&
      'in' in where.idBodega &&
      Array.isArray(where.idBodega.in)
    ) {
      parsed.idBodegas = where.idBodega.in.filter(
        (id): id is string => typeof id === 'string',
      );
    }

    if (typeof where.estado === 'string') {
      parsed.estado = where.estado;
    }

    return parsed;
  }

  private async loadOrdenVenta(
    client: SqlClient,
    schema: string,
    idOrdenVenta: string,
  ): Promise<OrdenVentaWithRelations | null> {
    const rows = await this.loadOrdenes(client, schema, {}, idOrdenVenta);
    return rows[0] ?? null;
  }

  private async loadOrdenes(
    client: SqlClient,
    schema: string,
    filters: ListWhereParsed,
    idOrdenVenta?: string,
  ): Promise<OrdenVentaWithRelations[]> {
    const params: unknown[] = [
      idOrdenVenta ?? null,
      filters.codigoCuenta ?? null,
      filters.estado ?? null,
    ];
    let bodegaClause = 'TRUE';
    if (filters.idBodegas && filters.idBodegas.length > 0) {
      params.push(filters.idBodegas);
      bodegaClause = `ov.id_bodega = ANY($${params.length}::uuid[])`;
    }

    const headers = await client.$queryRawUnsafe<OvHeaderRow[]>(
      `SELECT ov.id_orden_venta AS "idOrdenVenta",
              ov.codigo_cuenta AS "codigoCuenta",
              ov.id_bodega AS "idBodega",
              ov.id_cliente AS "idCliente",
              ov.id_comprador AS "idComprador",
              ov.id_planta AS "idPlanta",
              ov.id_creador AS "idCreador",
              ov.id_bodega_destino AS "idBodegaDestino",
              ov.codigo,
              ov.estado,
              ov.fecha_pedido AS "fechaPedido",
              ov.observaciones,
              ov.created_at AS "createdAt",
              ov.updated_at AS "updatedAt",
              c.nombre AS "clienteNombre",
              c.esta_activo AS "clienteActivo",
              co.nombre AS "compradorNombre",
              co.esta_activo AS "compradorActivo",
              b.nombre AS "bodegaNombre",
              b.esta_activa AS "bodegaActiva",
              b.codigo_cuenta AS "bodegaCodigoCuenta",
              bd.nombre AS "bodegaDestinoNombre",
              bd.esta_activa AS "bodegaDestinoActiva"
       FROM ${schema}.orden_venta ov
       JOIN ${schema}.cliente c ON c.id_cliente = ov.id_cliente
       JOIN ${schema}.bodega b ON b.id_bodega = ov.id_bodega
       LEFT JOIN ${schema}.comprador co ON co.id_comprador = ov.id_comprador
       LEFT JOIN ${schema}.bodega bd ON bd.id_bodega = ov.id_bodega_destino
       WHERE ($1::uuid IS NULL OR ov.id_orden_venta = $1::uuid)
         AND ($2::text IS NULL OR ov.codigo_cuenta = $2)
         AND ${bodegaClause}
         AND ($3::text IS NULL OR ov.estado::text = $3)
       ORDER BY ov.fecha_pedido DESC, ov.created_at DESC`,
      ...params,
    );

    if (headers.length === 0) {
      return [];
    }

    const ids = headers.map((row) => row.idOrdenVenta);
    const lineas = await client.$queryRawUnsafe<OvLineaRow[]>(
      `SELECT l.id_linea_orden_venta AS "idLineaOrdenVenta",
              l.id_orden_venta AS "idOrdenVenta",
              l.id_producto AS "idProducto",
              l.cantidad_pedida AS "cantidadPedida",
              l.cantidad_despachada AS "cantidadDespachada",
              p.sku,
              p.descripcion,
              p.esta_activo AS "estaActivo",
              p.metadatos_catalogo AS "metadatosCatalogo"
       FROM ${schema}.orden_venta_linea l
       JOIN ${schema}.producto p ON p.id_producto = l.id_producto
       WHERE l.id_orden_venta = ANY($1::uuid[])
       ORDER BY l.id_linea_orden_venta ASC`,
      ids,
    );

    const lineasByOrden = new Map<string, OvLineaRow[]>();
    for (const linea of lineas) {
      const bucket = lineasByOrden.get(linea.idOrdenVenta) ?? [];
      bucket.push(linea);
      lineasByOrden.set(linea.idOrdenVenta, bucket);
    }

    return headers.map((header) =>
      this.mapOrden(header, lineasByOrden.get(header.idOrdenVenta) ?? []),
    );
  }

  private mapOrden(
    header: OvHeaderRow,
    lineas: OvLineaRow[],
  ): OrdenVentaWithRelations {
    return {
      idOrdenVenta: header.idOrdenVenta,
      codigoCuenta: header.codigoCuenta,
      idBodega: header.idBodega,
      idCliente: header.idCliente,
      idComprador: header.idComprador,
      idPlanta: header.idPlanta,
      idCreador: header.idCreador,
      idBodegaDestino: header.idBodegaDestino,
      codigo: header.codigo,
      estado: header.estado,
      fechaPedido: this.toDate(header.fechaPedido),
      observaciones: header.observaciones,
      createdAt: this.toDate(header.createdAt),
      updatedAt: this.toDate(header.updatedAt),
      cliente: {
        idCliente: header.idCliente,
        nombre: header.clienteNombre,
        estaActivo: header.clienteActivo,
      },
      comprador: header.idComprador
        ? {
            idComprador: header.idComprador,
            nombre: header.compradorNombre ?? '',
            estaActivo: header.compradorActivo ?? false,
          }
        : null,
      bodega: {
        idBodega: header.idBodega,
        nombre: header.bodegaNombre,
        estaActiva: header.bodegaActiva,
        codigoCuenta: header.bodegaCodigoCuenta,
      },
      bodegaDestino: header.idBodegaDestino
        ? {
            idBodega: header.idBodegaDestino,
            nombre: header.bodegaDestinoNombre ?? '',
            estaActiva: header.bodegaDestinoActiva ?? false,
          }
        : null,
      lineas: lineas.map((linea) => ({
        idLineaOrdenVenta: linea.idLineaOrdenVenta,
        idOrdenVenta: header.idOrdenVenta,
        idProducto: linea.idProducto,
        cantidadPedida: this.toDecimal(linea.cantidadPedida),
        cantidadDespachada: this.toDecimal(linea.cantidadDespachada),
        producto: {
          idProducto: linea.idProducto,
          sku: linea.sku,
          descripcion: linea.descripcion,
          estaActivo: linea.estaActivo,
          metadatosCatalogo: linea.metadatosCatalogo,
        },
      })),
    };
  }

  private toDecimal(value: Prisma.Decimal | string | number): Prisma.Decimal {
    if (value instanceof Prisma.Decimal) {
      return value;
    }
    return new Prisma.Decimal(value);
  }

  private toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }
}
