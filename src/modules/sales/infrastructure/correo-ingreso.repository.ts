import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
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
