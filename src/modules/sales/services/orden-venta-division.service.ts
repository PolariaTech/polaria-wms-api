import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
import { assertOperationalTenantScope } from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { claveOc } from '../ai/utils/reagrupacion-division.validator';
import {
  parseOrigenCorreoJson,
  type OrigenCorreoRenglon,
} from '../ai/utils/origen-correo-ordenes-trabajo';
import type {
  DividirOrdenVentaBodyDto,
  DividirOrdenVentaResponseDto,
} from '../dto/dividir-orden-venta.dto';

interface FilaOrden {
  idOrdenVenta: string;
  codigoCuenta: string;
  idBodega: string;
  estado: string;
  origenCorreo: unknown;
}

// Copia la cabecera de la OV actual (cliente, comprador, entrega, ventana…) y
// solo cambia los renglones y la orden de compra. El código lo asigna la base.
const INSERTAR_OV_DIVIDIDA = (schema: string) => `INSERT INTO ${schema}.orden_venta (
  codigo, codigo_cuenta, id_bodega, id_cliente, id_comprador, estado,
  origen_correo, origen_texto, origen_archivos, orden_compra_hotel,
  centro_consumo, contacto_entrega, fecha_entrega, ventana_desde, ventana_hasta,
  direccion_entrega, anden, telefono_contacto, notas_almacen, prioridad
)
SELECT '', codigo_cuenta, id_bodega, id_cliente, id_comprador, estado,
  $2::jsonb, origen_texto, origen_archivos, $3,
  centro_consumo, contacto_entrega, fecha_entrega, ventana_desde, ventana_hasta,
  direccion_entrega, anden, telefono_contacto, notas_almacen, prioridad
FROM ${schema}.orden_venta
WHERE id_orden_venta = $1::uuid
RETURNING id_orden_venta AS "idOrdenVenta", codigo`;

function ocDe(renglon: OrigenCorreoRenglon): string {
  return (renglon['Numero pedido'] ?? '').toString().trim();
}

function reenumerar(renglones: OrigenCorreoRenglon[]): OrigenCorreoRenglon[] {
  return renglones.map((renglon, indice) => ({
    ...renglon,
    _lineaIndex: indice,
  }));
}

/**
 * REQ-262 / REQ-273: parte una OV `por_confirmar` en una OV por orden de compra.
 * Las que salen se crean copiando la cabecera; la actual se queda con las demás.
 * Todo ocurre en una sola transacción.
 */
@Injectable()
export class OrdenVentaDivisionService {
  private readonly logger = new Logger(OrdenVentaDivisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantLocator: TenantSchemaLocator,
  ) {}

  async dividir(
    idOrdenVenta: string,
    body: DividirOrdenVentaBodyDto,
    ctx: TenantContext,
  ): Promise<DividirOrdenVentaResponseDto> {
    const schema = this.tenantLocator.assertSafeSchemaIdent(
      ctx.schemaName?.trim() || 'public',
    );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const filas = await tx.$queryRawUnsafe<FilaOrden[]>(
          `SELECT id_orden_venta AS "idOrdenVenta",
                  codigo_cuenta AS "codigoCuenta",
                  id_bodega AS "idBodega",
                  estado::text AS estado,
                  origen_correo AS "origenCorreo"
           FROM ${schema}.orden_venta
           WHERE id_orden_venta = $1::uuid
           FOR UPDATE`,
          idOrdenVenta,
        );
        const orden = filas[0];
        if (!orden) throw this.noEncontrada();
        this.validarAcceso(orden, ctx);

        const { salen, quedan } = this.repartir(
          parseOrigenCorreoJson(orden.origenCorreo),
          body.ocSalen,
        );

        const ordenesNuevas: DividirOrdenVentaResponseDto['ordenesNuevas'] =
          [];
        for (const [ordenCompra, renglones] of salen) {
          const creadas = await tx.$queryRawUnsafe<
            Array<{ idOrdenVenta: string; codigo: string }>
          >(
            INSERTAR_OV_DIVIDIDA(schema),
            idOrdenVenta,
            JSON.stringify(reenumerar(renglones)),
            ordenCompra,
          );
          const creada = creadas[0];
          if (!creada) throw new Error('INSERT sin fila');
          ordenesNuevas.push({ ...creada, ordenCompra });
        }

        const ocQuedan = [...quedan.keys()];
        await tx.$executeRawUnsafe(
          `UPDATE ${schema}.orden_venta
           SET origen_correo = $2::jsonb,
               orden_compra_hotel = COALESCE($3, orden_compra_hotel),
               updated_at = now()
           WHERE id_orden_venta = $1::uuid`,
          idOrdenVenta,
          JSON.stringify(reenumerar([...quedan.values()].flat())),
          ocQuedan.length === 1 ? ocQuedan[0] : null,
        );

        this.logger.log(
          JSON.stringify({
            evento: 'dividir_ov',
            idOrdenVenta,
            nuevas: ordenesNuevas.length,
          }),
        );
        return { idOrdenVenta, ordenesNuevas, ocQuedan };
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      // Solo metadatos: el error crudo de la base de datos no se devuelve.
      this.logger.error(
        JSON.stringify({ evento: 'dividir_ov', resultado: 'error_bd' }),
      );
      throw new InternalServerErrorException({
        message: 'No se pudo dividir la orden de venta. Intenta de nuevo.',
        error: 'BASE_DATOS',
      });
    }
  }

  /** Una OV de otra cuenta responde igual que una inexistente. */
  private validarAcceso(orden: FilaOrden, ctx: TenantContext): void {
    try {
      assertOperationalTenantScope(ctx, {
        codigoCuenta: orden.codigoCuenta,
        idBodega: orden.idBodega,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw this.noEncontrada();
      throw error;
    }
    if (orden.estado !== 'por_confirmar') {
      throw new ConflictException({
        message: 'La orden de venta ya no está por confirmar.',
        error: 'OV_ESTADO_CAMBIO',
      });
    }
  }

  /** Reparte los renglones por orden de compra; valida que algo salga y algo se quede. */
  private repartir(
    renglones: OrigenCorreoRenglon[],
    ocSalenPedidas: readonly string[],
  ): {
    salen: Map<string, OrigenCorreoRenglon[]>;
    quedan: Map<string, OrigenCorreoRenglon[]>;
  } {
    const pedidas = new Set(ocSalenPedidas.map(claveOc));
    const salen = new Map<string, OrigenCorreoRenglon[]>();
    const quedan = new Map<string, OrigenCorreoRenglon[]>();
    const vistas = new Set<string>();

    for (const renglon of renglones) {
      const oc = ocDe(renglon);
      const clave = claveOc(oc);
      vistas.add(clave);
      const destino = pedidas.has(clave) ? salen : quedan;
      destino.set(oc, [...(destino.get(oc) ?? []), renglon]);
    }

    if ([...pedidas].some((clave) => !vistas.has(clave))) {
      throw new BadRequestException({
        message: 'Alguna de las órdenes de compra no está en esta orden.',
        error: 'OC_INEXISTENTE',
      });
    }
    if (salen.size === 0 || quedan.size === 0) {
      throw new BadRequestException({
        message:
          'La orden debe conservar al menos una orden de compra y sacar al menos una.',
        error: 'DIVISION_INVALIDA',
      });
    }
    return { salen, quedan };
  }

  private noEncontrada(): NotFoundException {
    return new NotFoundException('No se encontró la orden de venta');
  }
}
