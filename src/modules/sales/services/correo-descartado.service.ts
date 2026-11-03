import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { CorreosQueryDto } from '../dto/correos-query.dto';
import type { CorreosListaResponseDto } from '../dto/correos-response.dto';
import type { IngresoCorreoResponseDto } from '../dto/ingreso-correo-response.dto';
import {
  CorreoIngresoRepository,
  type CorreoIngresoFila,
} from '../infrastructure/correo-ingreso.repository';
import {
  N8nCorreosClient,
  type CorreoN8nAdjunto,
  type CorreoN8nCompleto,
} from '../infrastructure/n8n-correos.client';
import { PedidoIaService } from './pedido-ia.service';

/** Ids de mensaje de Gmail: hexadecimales cortos; se acota por seguridad. */
const MESSAGE_ID = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_ADJUNTOS = 8;
const MAX_TEXTO = 20_000;

const aDto = (fila: CorreoIngresoFila): IngresoCorreoResponseDto => ({
  messageId: fila.messageId,
  estado: fila.estado,
  idOrdenVenta: fila.idOrdenVenta,
  codigoOrdenVenta: fila.codigoOrdenVenta,
  error: fila.error,
});

function aArchivo(a: CorreoN8nAdjunto): Express.Multer.File {
  const buffer = Buffer.from(a.base64, 'base64');
  return {
    fieldname: 'archivos',
    originalname: a.nombre,
    encoding: '7bit',
    mimetype: a.mimeType,
    size: buffer.length,
    buffer,
  } as Express.Multer.File;
}

function sinHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function armarTexto(c: CorreoN8nCompleto): string {
  const cuerpo = c.texto.trim() || sinHtml(c.html);
  return [
    c.asunto && `Asunto: ${c.asunto}`,
    c.de && `De: ${c.de}`,
    c.para && `Para: ${c.para}`,
    c.fecha && `Fecha: ${c.fecha}`,
    cuerpo && `\n${cuerpo}`,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_TEXTO);
}

function mensajeDe(err: unknown): string {
  if (err instanceof HttpException) {
    const r = err.getResponse();
    if (typeof r === 'string') return r;
    const m = (r as { message?: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.map(String).join('; ');
  }
  return err instanceof Error
    ? err.message
    : 'Error desconocido al ingresar el correo.';
}

/**
 * REQ-104: lista los correos que n8n registró y deja al operador ingresar a mano como OV
 * los que el workflow descartó. El ingreso es asíncrono (la lectura con IA pasa de los
 * 30 s del proxy de Next): reserva la fila, responde 202 y termina en segundo plano; la
 * web consulta el estado hasta que pase a `ingresado` o `error`.
 */
@Injectable()
export class CorreoDescartadoService {
  private readonly logger = new Logger(CorreoDescartadoService.name);

  constructor(
    private readonly n8n: N8nCorreosClient,
    private readonly ingresos: CorreoIngresoRepository,
    private readonly pedidoIa: PedidoIaService,
    private readonly config: ConfigService,
  ) {}

  async listar(
    query: CorreosQueryDto,
    ctx: TenantContext,
  ): Promise<CorreosListaResponseDto> {
    const cuenta = this.cuentaHabilitada(ctx);
    const { total, filas } = await this.n8n.listar(query);
    const ingresos = await this.ingresos.listarPorMessageIds(
      ctx.schemaName,
      cuenta,
      filas.map((f) => f.messageId),
    );
    const porId = new Map(ingresos.map((i) => [i.messageId, i]));
    return {
      total,
      pagina: query.pagina,
      tamano: query.tamano,
      filas: filas.map((f) => {
        const ingreso = porId.get(f.messageId);
        return { ...f, ingreso: ingreso ? aDto(ingreso) : null };
      }),
    };
  }

  async ingresar(
    messageId: string,
    ctx: TenantContext,
  ): Promise<IngresoCorreoResponseDto> {
    const cuenta = this.cuentaHabilitada(ctx);
    this.validarMessageId(messageId);

    const { reservada, fila } = await this.ingresos.reservar({
      schemaName: ctx.schemaName,
      codigoCuenta: cuenta,
      messageId,
      hilo: null,
      ingresadoPor: ctx.idUsuario,
    });

    if (!reservada) {
      if (fila.estado === 'ingresado') {
        throw new ConflictException({
          code: 'CORREO_YA_INGRESADO',
          message: `Este pedido ya fue ingresado como ${fila.codigoOrdenVenta ?? 'una OV'}.`,
          codigoOrdenVenta: fila.codigoOrdenVenta,
        });
      }
      // Ya lo está procesando otra llamada: no se duplica, se devuelve el estado actual.
      return aDto(fila);
    }

    void this.procesar(cuenta, ctx.schemaName, messageId);
    return aDto(fila);
  }

  async consultar(
    messageId: string,
    ctx: TenantContext,
  ): Promise<IngresoCorreoResponseDto> {
    const cuenta = this.cuentaHabilitada(ctx);
    this.validarMessageId(messageId);
    const fila = await this.ingresos.buscar(ctx.schemaName, cuenta, messageId);
    if (!fila) {
      throw new NotFoundException({
        code: 'INGRESO_NO_ENCONTRADO',
        message: 'Este correo todavía no se ha intentado ingresar.',
      });
    }
    return aDto(fila);
  }

  private async procesar(
    cuenta: string,
    schemaName: string | null,
    messageId: string,
  ): Promise<void> {
    try {
      const correo = await this.n8n.obtener(messageId);
      const files = correo.adjuntos.slice(0, MAX_ADJUNTOS).map(aArchivo);
      const textoPedido = armarTexto(correo);
      if (!textoPedido && files.length === 0) {
        throw new BadRequestException(
          'El correo no trae texto ni adjuntos para leer.',
        );
      }
      const ov = await this.pedidoIa.ingestarPedido({
        codigoCuenta: cuenta,
        texto: textoPedido,
        files,
      });
      await this.ingresos.marcarIngresado({
        schemaName,
        codigoCuenta: cuenta,
        messageId,
        idOrdenVenta: ov.idOrdenVenta,
        codigoOrdenVenta: ov.codigo,
      });
    } catch (err) {
      this.logger.warn(
        `Ingreso del correo ${messageId} falló: ${mensajeDe(err)}`,
      );
      await this.ingresos
        .marcarError({
          schemaName,
          codigoCuenta: cuenta,
          messageId,
          error: mensajeDe(err),
        })
        .catch((e: unknown) =>
          this.logger.error(
            `No se pudo guardar el error de ${messageId}: ${mensajeDe(e)}`,
          ),
        );
    }
  }

  private validarMessageId(messageId: string): void {
    if (!MESSAGE_ID.test(messageId)) {
      throw new BadRequestException({
        code: 'MESSAGE_ID_INVALIDO',
        message: 'El identificador del correo no es válido.',
      });
    }
  }

  /** Solo las cuentas listadas en `N8N_CORREOS_CUENTAS` ven y ingresan estos correos. */
  private cuentaHabilitada(ctx: TenantContext): string {
    const cuenta = ctx.codigoCuenta?.trim().toUpperCase();
    const permitidas = (this.config.get<string>('N8N_CORREOS_CUENTAS') ?? '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (!cuenta || !permitidas.includes(cuenta)) {
      throw new ForbiddenException({
        code: 'CORREOS_NO_DISPONIBLES',
        message:
          'Los correos de pedidos no están habilitados para esta cuenta.',
      });
    }
    return cuenta;
  }
}
