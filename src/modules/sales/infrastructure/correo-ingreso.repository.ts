import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
import type { EstadoIngresoCorreo } from '../dto/ingreso-correo-response.dto';
import {
  armarFiltroEntradas,
  COLUMNAS_ENTRADA,
  type CorreoEntradaFila,
  type FiltroCorreosEntrada,
  type ListaCorreosEntrada,
} from './correo-entrada.consultas';
import {
  ERROR_INTENTO_VENCIDO,
  MENSAJE_INGRESO_VENCIDO,
  selloNumeroCorreo,
  sqlCerrarUltimoIntento,
  sqlIntentoAppendUpdate,
  sqlIntentoInicialInsert,
} from './correo-ingreso.consultas';

/** Minutos tras los que un ingreso `procesando` se considera abandonado y se puede reintentar. */
export const MINUTOS_INGRESO_ABANDONADO = 7;

export interface CorreoIngresoFila {
  idCorreoIngreso: string;
  messageId: string;
  estado: EstadoIngresoCorreo;
  idOrdenVenta: string | null;
  codigoOrdenVenta: string | null;
  error: string | null;
}

export interface ReservaCorreo {
  /** `true` si esta llamada reservó el correo y debe procesarlo. */
  reservada: boolean;
  fila: CorreoIngresoFila;
  /** Largo de `intentos` tras ganar la reserva; 1 = primer intento. */
  numeroIntentos: number;
}

export interface OvPorNumeroCorreo {
  idOrdenVenta: string;
  codigo: string;
}

export type {
  CorreoEntradaFila,
  FiltroCorreosEntrada,
  ListaCorreosEntrada,
} from './correo-entrada.consultas';

const COLUMNAS = `
  id_correo_ingreso AS "idCorreoIngreso",
  message_id AS "messageId",
  estado AS "estado",
  id_orden_venta AS "idOrdenVenta",
  codigo_orden_venta AS "codigoOrdenVenta",
  error AS "error"`;

/**
 * Tabla `correo_pedido_ingreso` (migración 114): relaciona el `message_id` de un correo
 * con la OV creada. La llave única (codigo_cuenta, message_id) es lo que impide duplicar
 * la OV con varios clics: SQL calificado por schema, sin modelo Prisma.
 */
@Injectable()
export class CorreoIngresoRepository {
  private readonly logger = new Logger(CorreoIngresoRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schemaLocator: TenantSchemaLocator,
  ) {}

  private tabla(schemaName: string | null | undefined): string {
    const schema = this.schemaLocator.assertSafeSchemaIdent(
      schemaName ?? 'public',
    );
    return `"${schema}".correo_pedido_ingreso`;
  }

  /**
   * Reserva el correo en estado `procesando`. Solo gana quien inserta la fila, o quien
   * la recupera de un `error` o de un `procesando` abandonado (más de 7 minutos).
   */
  async reservar(input: {
    schemaName: string | null | undefined;
    codigoCuenta: string;
    messageId: string;
    hilo: string | null;
    ingresadoPor: string;
  }): Promise<ReservaCorreo> {
    const tabla = this.tabla(input.schemaName);
    const ganadas = await this.prisma.$queryRawUnsafe<
      Array<CorreoIngresoFila & { numeroIntentos?: number | bigint }>
    >(
      `INSERT INTO ${tabla} AS c
         (codigo_cuenta, message_id, hilo, estado, origen, ingresado_por, intentos)
       VALUES ($1, $2, $3, 'procesando', 'manual', $4, ${sqlIntentoInicialInsert()})
       ON CONFLICT (codigo_cuenta, message_id) DO UPDATE
         SET estado = 'procesando', error = NULL,
             ingresado_por = EXCLUDED.ingresado_por, updated_at = now(),
             intentos = ${sqlIntentoAppendUpdate()}
         WHERE c.estado = 'error'
            OR (c.estado = 'procesando'
                AND c.updated_at < now() - interval '${MINUTOS_INGRESO_ABANDONADO} minutes')
       RETURNING ${COLUMNAS}, jsonb_array_length(intentos) AS "numeroIntentos"`,
      input.codigoCuenta,
      input.messageId,
      input.hilo,
      input.ingresadoPor,
    );
    const ganada = ganadas[0];
    if (ganada) {
      const { numeroIntentos, ...fila } = ganada;
      return {
        reservada: true,
        fila,
        numeroIntentos: Number(numeroIntentos ?? 1),
      };
    }

    const existente = await this.buscar(
      input.schemaName,
      input.codigoCuenta,
      input.messageId,
    );
    if (!existente) {
      throw new Error('El correo no quedó reservado ni existe en el registro.');
    }
    return { reservada: false, fila: existente, numeroIntentos: 0 };
  }

  async marcarIngresado(input: {
    schemaName: string | null | undefined;
    codigoCuenta: string;
    messageId: string;
    idOrdenVenta: string;
    codigoOrdenVenta: string;
  }): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE ${this.tabla(input.schemaName)}
          SET estado = 'ingresado', id_orden_venta = $3::uuid,
              codigo_orden_venta = $4, error = NULL, updated_at = now(),
              intentos = ${sqlCerrarUltimoIntento('ingresado', 'NULL')}
        WHERE codigo_cuenta = $1 AND message_id = $2`,
      input.codigoCuenta,
      input.messageId,
      input.idOrdenVenta,
      input.codigoOrdenVenta,
    );
  }

  async marcarError(input: {
    schemaName: string | null | undefined;
    codigoCuenta: string;
    messageId: string;
    error: string;
  }): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE ${this.tabla(input.schemaName)}
          SET estado = 'error', error = $3, updated_at = now(),
              intentos = ${sqlCerrarUltimoIntento('error', '$3')}
        WHERE codigo_cuenta = $1 AND message_id = $2`,
      input.codigoCuenta,
      input.messageId,
      input.error.slice(0, 500),
    );
  }

  async buscar(
    schemaName: string | null | undefined,
    codigoCuenta: string,
    messageId: string,
  ): Promise<CorreoIngresoFila | null> {
    await this.expirarVencidos(schemaName, codigoCuenta, [messageId]);
    const filas = await this.prisma.$queryRawUnsafe<CorreoIngresoFila[]>(
      `SELECT ${COLUMNAS} FROM ${this.tabla(schemaName)}
        WHERE codigo_cuenta = $1 AND message_id = $2`,
      codigoCuenta,
      messageId,
    );
    return filas[0] ?? null;
  }

  /**
   * Un `procesando` con más de 7 min se guarda como `error` al leer (sin barrido).
   * Si `intentos` está vacío (filas anteriores a POL-417) no se hace jsonb_set.
   */
  async expirarVencidos(
    schemaName: string | null | undefined,
    codigoCuenta: string,
    messageIds: string[],
  ): Promise<void> {
    if (messageIds.length === 0) return;
    await this.prisma.$queryRawUnsafe(
      `UPDATE ${this.tabla(schemaName)}
          SET estado = 'error',
              error = $3,
              updated_at = now(),
              intentos = ${sqlCerrarUltimoIntento('vencido', '$4')}
        WHERE codigo_cuenta = $1
          AND message_id = ANY($2::text[])
          AND estado = 'procesando'
          AND updated_at < now() - interval '${MINUTOS_INGRESO_ABANDONADO} minutes'`,
      codigoCuenta,
      messageIds,
      MENSAJE_INGRESO_VENCIDO,
      ERROR_INTENTO_VENCIDO,
    );
  }

  /** OV ya selladas con el message_id; aislada para corregir nombres de columna. */
  async buscarOvsPorNumeroCorreo(
    schemaName: string | null | undefined,
    codigoCuenta: string,
    messageId: string,
  ): Promise<OvPorNumeroCorreo[]> {
    const schema = this.schemaLocator.assertSafeSchemaIdent(
      schemaName ?? 'public',
    );
    return this.prisma.$queryRawUnsafe<OvPorNumeroCorreo[]>(
      `SELECT id_orden_venta AS "idOrdenVenta", codigo
         FROM "${schema}".orden_venta
        WHERE codigo_cuenta = $1 AND origen_correo @> $2::jsonb`,
      codigoCuenta,
      selloNumeroCorreo(messageId),
    );
  }

  /**
   * POL-410: la lista de correos recibidos, de la tabla `correo_pedido_entrada` (antes el
   * data table de n8n). Filtra y pagina en SQL, y toda consulta lleva `codigo_cuenta`: en el
   * esquema de la empresa la política de seguridad aísla por empresa, no por cuenta.
   */
  async listarEntradas(
    schemaName: string | null | undefined,
    codigoCuenta: string,
    filtro: FiltroCorreosEntrada,
  ): Promise<ListaCorreosEntrada> {
    if (!codigoCuenta?.trim()) {
      // Sin la cuenta, la consulta traería los correos de todas las cuentas del esquema.
      throw new Error('La lista de correos exige el código de la cuenta.');
    }
    const schema = this.schemaLocator.assertSafeSchemaIdent(
      schemaName ?? 'public',
    );
    const tabla = `"${schema}".correo_pedido_entrada`;
    const { donde, params } = armarFiltroEntradas(codigoCuenta, filtro);

    try {
      const [conteo, filas] = await Promise.all([
        this.prisma.$queryRawUnsafe<{ total: number }[]>(
          `SELECT count(*)::int AS total FROM ${tabla} WHERE ${donde}`,
          ...params,
        ),
        this.prisma.$queryRawUnsafe<CorreoEntradaFila[]>(
          `SELECT ${COLUMNAS_ENTRADA} FROM ${tabla}
            WHERE ${donde}
            ORDER BY recibido_en DESC NULLS LAST, created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          ...params,
          filtro.tamano,
          (filtro.pagina - 1) * filtro.tamano,
        ),
      ]);
      return { total: conteo[0]?.total ?? 0, filas };
    } catch (causa) {
      // El detalle de la base queda en el registro para soporte; al cliente no se le muestra.
      this.logger.error(
        `No se pudo leer la lista de correos de ${schema} (cuenta ${codigoCuenta}): ${
          causa instanceof Error ? causa.message : String(causa)
        }`,
      );
      throw new ServiceUnavailableException({
        error: 'CORREOS_LECTURA_FALLIDA',
        message:
          'No se pudo leer la lista de correos. Intenta de nuevo en unos minutos.',
      });
    }
  }

  /** Para pintar la lista: el estado de ingreso de varios correos en una sola consulta. */
  async listarPorMessageIds(
    schemaName: string | null | undefined,
    codigoCuenta: string,
    messageIds: string[],
  ): Promise<CorreoIngresoFila[]> {
    if (messageIds.length === 0) return [];
    await this.expirarVencidos(schemaName, codigoCuenta, messageIds);
    return this.prisma.$queryRawUnsafe<CorreoIngresoFila[]>(
      `SELECT ${COLUMNAS} FROM ${this.tabla(schemaName)}
        WHERE codigo_cuenta = $1 AND message_id = ANY($2::text[])`,
      codigoCuenta,
      messageIds,
    );
  }
}
