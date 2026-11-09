import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
import type { ModoCorreos } from '../dto/correos-query.dto';
import type { EstadoIngresoCorreo } from '../dto/ingreso-correo-response.dto';

/** Minutos tras los que un ingreso `procesando` se considera abandonado y se puede reintentar. */
export const MINUTOS_INGRESO_ABANDONADO = 10;

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
}

/** Una fila de `correo_pedido_entrada`, con los nombres del contrato `CorreoFilaDto`. */
export interface CorreoEntradaFila {
  recibidoEn: string | null;
  de: string | null;
  para: string | null;
  asunto: string | null;
  messageId: string;
  hilo: string | null;
  adjunto: string | null;
  nuevoPedido: boolean | null;
  motivo: string | null;
  /** Qué hizo el workflow con el correo: recibido, ingresado, duplicado, error o no_es_pedido. */
  resultado: string | null;
  /** Qué tan seguro estaba el clasificador: alta, media o baja. */
  confianza: string | null;
  tipo: string | null;
  /** OV en que se convirtió el correo; varias separadas por coma si salieron más de una. */
  codigoOrdenVenta: string | null;
  idRegistro: string;
  registradoEn: string;
  actualizadoEn: string;
}

export interface FiltroCorreosEntrada {
  modo: ModoCorreos;
  pagina: number;
  tamano: number;
  desde?: string;
  hasta?: string;
  remitente?: string;
  asunto?: string;
}

export interface ListaCorreosEntrada {
  total: number;
  filas: CorreoEntradaFila[];
}

/** Las fechas salen en ISO 8601 UTC, como las entregaba el Puente de n8n. */
const iso = (columna: string) =>
  `to_char(${columna} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const COLUMNAS_ENTRADA = `
  ${iso('recibido_en')} AS "recibidoEn",
  de AS "de",
  para AS "para",
  asunto AS "asunto",
  message_id AS "messageId",
  hilo AS "hilo",
  adjunto AS "adjunto",
  nuevo_pedido AS "nuevoPedido",
  motivo AS "motivo",
  resultado AS "resultado",
  confianza AS "confianza",
  tipo AS "tipo",
  codigo_orden_venta AS "codigoOrdenVenta",
  id_correo_entrada::text AS "idRegistro",
  ${iso('created_at')} AS "registradoEn",
  ${iso('updated_at')} AS "actualizadoEn"`;

/** El texto del usuario se busca tal cual: `%`, `_` y `\` pierden su valor de comodín. */
const contiene = (texto: string) =>
  `%${texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`)}%`;

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
   * la recupera de un `error` o de un `procesando` abandonado (más de 10 minutos).
   */
  async reservar(input: {
    schemaName: string | null | undefined;
    codigoCuenta: string;
    messageId: string;
    hilo: string | null;
    ingresadoPor: string;
  }): Promise<ReservaCorreo> {
    const tabla = this.tabla(input.schemaName);
    const ganadas = await this.prisma.$queryRawUnsafe<CorreoIngresoFila[]>(
      `INSERT INTO ${tabla} AS c
         (codigo_cuenta, message_id, hilo, estado, origen, ingresado_por)
       VALUES ($1, $2, $3, 'procesando', 'manual', $4)
       ON CONFLICT (codigo_cuenta, message_id) DO UPDATE
         SET estado = 'procesando', error = NULL,
             ingresado_por = EXCLUDED.ingresado_por, updated_at = now()
         WHERE c.estado = 'error'
            OR (c.estado = 'procesando'
                AND c.updated_at < now() - interval '${MINUTOS_INGRESO_ABANDONADO} minutes')
       RETURNING ${COLUMNAS}`,
      input.codigoCuenta,
      input.messageId,
      input.hilo,
      input.ingresadoPor,
    );
    if (ganadas[0]) return { reservada: true, fila: ganadas[0] };

    const existente = await this.buscar(
      input.schemaName,
      input.codigoCuenta,
      input.messageId,
    );
    if (!existente) {
      throw new Error('El correo no quedó reservado ni existe en el registro.');
    }
    return { reservada: false, fila: existente };
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
              codigo_orden_venta = $4, error = NULL, updated_at = now()
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
          SET estado = 'error', error = $3, updated_at = now()
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
    const filas = await this.prisma.$queryRawUnsafe<CorreoIngresoFila[]>(
      `SELECT ${COLUMNAS} FROM ${this.tabla(schemaName)}
        WHERE codigo_cuenta = $1 AND message_id = $2`,
      codigoCuenta,
      messageId,
    );
    return filas[0] ?? null;
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

    const params: unknown[] = [codigoCuenta];
    const condiciones = ['codigo_cuenta = $1'];
    const agregar = (
      condicion: (marcador: string) => string,
      valor: unknown,
    ) => {
      params.push(valor);
      condiciones.push(condicion(`$${params.length}`));
    };
    if (filtro.modo === 'descartados') condiciones.push('nuevo_pedido = false');
    if (filtro.desde) {
      agregar((p) => `recibido_en >= ${p}::timestamptz`, filtro.desde);
    }
    if (filtro.hasta) {
      agregar((p) => `recibido_en <= ${p}::timestamptz`, filtro.hasta);
    }
    if (filtro.remitente) {
      agregar((p) => `de ILIKE ${p} ESCAPE '\\'`, contiene(filtro.remitente));
    }
    if (filtro.asunto) {
      agregar((p) => `asunto ILIKE ${p} ESCAPE '\\'`, contiene(filtro.asunto));
    }
    const donde = condiciones.join(' AND ');

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
  }

  /** Para pintar la lista: el estado de ingreso de varios correos en una sola consulta. */
  async listarPorMessageIds(
    schemaName: string | null | undefined,
    codigoCuenta: string,
    messageIds: string[],
  ): Promise<CorreoIngresoFila[]> {
    if (messageIds.length === 0) return [];
    return this.prisma.$queryRawUnsafe<CorreoIngresoFila[]>(
      `SELECT ${COLUMNAS} FROM ${this.tabla(schemaName)}
        WHERE codigo_cuenta = $1 AND message_id = ANY($2::text[])`,
      codigoCuenta,
      messageIds,
    );
  }
}
