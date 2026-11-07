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
import {
  claveDeFila,
  claveDeValor,
  horarioDeFila,
  valorVisible,
  type CriterioDivision,
} from '../ai/utils/claves-division';
import {
  groupKeyOrigenCorreo,
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

/** Renglones de las tareas que comparten un valor del criterio. */
interface Grupo {
  valor: string;
  renglones: OrigenCorreoRenglon[];
}

// Copia la cabecera de la OV actual (cliente, comprador, entrega, ventana…). Solo cambian
// los renglones y lo que el criterio distingue: $3 orden de compra, $4 día, $5 y $6
// ventana; si vienen vacíos se conserva lo de la OV actual. El código lo asigna la base.
const INSERTAR_OV_DIVIDIDA = (schema: string) => `INSERT INTO ${schema}.orden_venta (
  codigo, codigo_cuenta, id_bodega, id_cliente, id_comprador, estado,
  origen_correo, origen_texto, origen_archivos, orden_compra_hotel,
  centro_consumo, contacto_entrega, fecha_entrega, ventana_desde, ventana_hasta,
  direccion_entrega, anden, telefono_contacto, notas_almacen, prioridad
)
SELECT '', codigo_cuenta, id_bodega, id_cliente, id_comprador, estado,
  $2::jsonb, origen_texto, origen_archivos, COALESCE($3, orden_compra_hotel),
  centro_consumo, contacto_entrega, COALESCE($4, fecha_entrega),
  COALESCE($5, ventana_desde), COALESCE($6, ventana_hasta),
  direccion_entrega, anden, telefono_contacto, notas_almacen, prioridad
FROM ${schema}.orden_venta
WHERE id_orden_venta = $1::uuid
RETURNING id_orden_venta AS "idOrdenVenta", codigo`;

const texto = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim() : '';

function reenumerar(renglones: OrigenCorreoRenglon[]): OrigenCorreoRenglon[] {
  return renglones.map((renglon, indice) => ({ ...renglon, _lineaIndex: indice }));
}

/** Primer valor no vacío de un campo entre los renglones; null si ninguno lo trae. */
function primero(
  renglones: OrigenCorreoRenglon[],
  leer: (renglon: OrigenCorreoRenglon) => unknown,
): string | null {
  for (const renglon of renglones) {
    const valor = texto(leer(renglon));
    if (valor) return valor;
  }
  return null;
}

/**
 * REQ-262 / REQ-273: parte una OV `por_confirmar` por orden de compra, día u horario de
 * entrega. Las que salen se crean copiando la cabecera; la actual se queda con las demás.
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
    const { criterio } = body;
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
          criterio,
          body.valoresSalen,
        );

        const ordenesNuevas: DividirOrdenVentaResponseDto['ordenesNuevas'] = [];
        for (const [clave, grupo] of salen) {
          const creadas = await tx.$queryRawUnsafe<
            Array<{ idOrdenVenta: string; codigo: string }>
          >(
            INSERTAR_OV_DIVIDIDA(schema),
            idOrdenVenta,
            JSON.stringify(reenumerar(grupo.renglones)),
            ...this.cabecera(criterio, [clave], grupo.renglones),
          );
          const creada = creadas[0];
          if (!creada) throw new Error('INSERT sin fila');
          ordenesNuevas.push({ ...creada, valor: grupo.valor });
        }

        const renglonesQuedan = [...quedan.values()].flatMap((g) => g.renglones);
        const [ordenCompra, fecha, desde, hasta] = this.cabecera(
          criterio,
          [...quedan.keys()],
          renglonesQuedan,
        );
        await tx.$executeRawUnsafe(
          `UPDATE ${schema}.orden_venta
           SET origen_correo = $2::jsonb,
               orden_compra_hotel = COALESCE($3, orden_compra_hotel),
               fecha_entrega = COALESCE($4, fecha_entrega),
               ventana_desde = COALESCE($5, ventana_desde),
               ventana_hasta = COALESCE($6, ventana_hasta),
               updated_at = now()
           WHERE id_orden_venta = $1::uuid`,
          idOrdenVenta,
          JSON.stringify(reenumerar(renglonesQuedan)),
          ordenCompra,
          fecha,
          desde,
          hasta,
        );

        this.logger.log(
          JSON.stringify({
            evento: 'dividir_ov',
            idOrdenVenta,
            criterio,
            nuevas: ordenesNuevas.length,
          }),
        );
        return {
          idOrdenVenta,
          criterio,
          ordenesNuevas,
          valoresQuedan: [...quedan.values()]
            .map((grupo) => grupo.valor)
            .filter((valor) => valor.length > 0),
        };
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

  /**
   * Datos de cabecera de un grupo: [orden de compra, día, ventana desde, ventana hasta].
   * El día y la ventana solo se cambian si el criterio los distingue y el grupo tiene un
   * único valor; si no, quedan en null y se conserva lo que ya tenía la OV.
   */
  private cabecera(
    criterio: CriterioDivision,
    claves: string[],
    renglones: OrigenCorreoRenglon[],
  ): [string | null, string | null, string | null, string | null] {
    const unico = claves.filter((clave) => clave.length > 0).length === 1;
    return [
      primero(renglones, (r) => r['Numero pedido']),
      criterio === 'dia' && unico ? primero(renglones, (r) => claveDeFila('dia', r)) : null,
      criterio === 'horario' && unico ? primero(renglones, (r) => r['Ventana desde']) : null,
      criterio === 'horario' && unico ? primero(renglones, (r) => r['Ventana hasta']) : null,
    ];
  }

  /** Una OV no se parte si es de otra cuenta (responde como inexistente) o ya no está por confirmar. */
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

  /**
   * Reparte las TAREAS (renglones de un mismo pedido y almacén) por el valor del criterio
   * en su primer renglón: es la misma clave con la que el formulario las agrupa y las quita.
   */
  private repartir(
    renglones: OrigenCorreoRenglon[],
    criterio: CriterioDivision,
    valoresSalen: readonly string[],
  ): { salen: Map<string, Grupo>; quedan: Map<string, Grupo> } {
    const tareas = new Map<string, OrigenCorreoRenglon[]>();
    for (const renglon of renglones) {
      const clave = groupKeyOrigenCorreo(renglon);
      tareas.set(clave, [...(tareas.get(clave) ?? []), renglon]);
    }

    const pedidas = new Set(valoresSalen.map((v) => claveDeValor(criterio, v)));
    const salen = new Map<string, Grupo>();
    const quedan = new Map<string, Grupo>();
    const vistas = new Set<string>();

    for (const filas of tareas.values()) {
      const clave = claveDeFila(criterio, filas[0]);
      if (clave) vistas.add(clave);
      const destino = clave && pedidas.has(clave) ? salen : quedan;
      const crudo =
        criterio === 'oc'
          ? filas[0]['Numero pedido']
          : criterio === 'dia'
            ? filas[0].Fecha
            : horarioDeFila(filas[0]);
      const grupo = destino.get(clave) ?? {
        valor: clave ? valorVisible(criterio, crudo) : '',
        renglones: [],
      };
      grupo.renglones.push(...filas);
      destino.set(clave, grupo);
    }

    if ([...pedidas].some((clave) => !vistas.has(clave))) {
      throw new BadRequestException({
        message: 'Alguno de los valores no está en esta orden.',
        error: 'VALOR_INEXISTENTE',
      });
    }
    if (salen.size === 0 || quedan.size === 0) {
      throw new BadRequestException({
        message: 'La orden debe conservar algo y sacar algo para poder dividirse.',
        error: 'DIVISION_INVALIDA',
      });
    }
    return { salen, quedan };
  }

  private noEncontrada(): NotFoundException {
    return new NotFoundException('No se encontró la orden de venta');
  }
}
