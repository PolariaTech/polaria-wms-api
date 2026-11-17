import {
  BadRequestException,
  type BeforeApplicationShutdown,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { CorreosQueryDto } from '../dto/correos-query.dto';
import type {
  CorreoContenidoResponseDto,
  CorreoFilaDto,
  CorreosListaResponseDto,
} from '../dto/correos-response.dto';
import type { IngresoCorreoResponseDto } from '../dto/ingreso-correo-response.dto';
import { CorreoIngresoRepository } from '../infrastructure/correo-ingreso.repository';
import { GmailCorreosClient } from '../infrastructure/gmail-correos.client';
import { aArchivo, armarTexto, mensajeDe } from './correo-descartado.texto';
import { aIngresoDto, conIngreso } from './correo-fila';
import { PedidoIaService } from './pedido-ia.service';

/** Ids de mensaje de Gmail: hexadecimales cortos; se acota por seguridad. */
const MESSAGE_ID = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_ADJUNTOS = 8;
const INDICE_ADJUNTO_MAX = 99;
const TOPE_APAGADO_MS = 25_000;

export interface AdjuntoDescargable {
  nombre: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * REQ-104 / REQ-317: lista los correos que n8n registró en Supabase, deja ver un correo
 * completo (Gmail API al buzón compartido) y permite ingresar a mano como OV los que el
 * workflow descartó. El ingreso es asíncrono: reserva, responde 202 y termina en segundo plano.
 */
@Injectable()
export class CorreoDescartadoService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(CorreoDescartadoService.name);
  private readonly enVuelo = new Set<Promise<void>>();

  constructor(
    private readonly gmail: GmailCorreosClient,
    private readonly ingresos: CorreoIngresoRepository,
    private readonly pedidoIa: PedidoIaService,
    private readonly config: ConfigService,
  ) {}

  async listar(
    query: CorreosQueryDto,
    ctx: TenantContext,
  ): Promise<CorreosListaResponseDto> {
    const cuenta = this.cuentaHabilitada(ctx);
    const { total, filas } = await this.ingresos.listarEntradas(
      ctx.schemaName,
      cuenta,
      query,
    );
    const ingresos = await this.ingresos.listarPorMessageIds(
      ctx.schemaName,
      cuenta,
      filas.map((fila) => fila.messageId),
    );
    const porId = new Map(
      ingresos.map((ingreso) => [ingreso.messageId, ingreso]),
    );
    return {
      total,
      pagina: query.pagina,
      tamano: query.tamano,
      filas: filas.map((fila) => conIngreso(fila, porId.get(fila.messageId))),
    };
  }

  async obtener(messageId: string, ctx: TenantContext): Promise<CorreoFilaDto> {
    const cuenta = this.cuentaHabilitada(ctx);
    this.validarMessageId(messageId);
    const fila = await this.ingresos.buscarEntrada(
      ctx.schemaName,
      cuenta,
      messageId,
    );
    if (!fila) {
      throw new NotFoundException({
        error: 'CORREO_NO_ENCONTRADO',
        message: 'No encontramos este correo en la lista de correos recibidos.',
      });
    }
    const ingreso = await this.ingresos.ingresoDeEntrada(
      ctx.schemaName,
      cuenta,
      messageId,
    );
    return conIngreso(fila, ingreso);
  }

  async ingresar(
    messageId: string,
    ctx: TenantContext,
  ): Promise<IngresoCorreoResponseDto> {
    const cuenta = this.cuentaHabilitada(ctx);
    this.validarMessageId(messageId);

    const { reservada, fila, numeroIntentos } = await this.ingresos.reservar({
      schemaName: ctx.schemaName,
      codigoCuenta: cuenta,
      messageId,
      hilo: null,
      ingresadoPor: ctx.idUsuario,
    });

    if (!reservada) {
      if (fila.estado === 'ingresado') {
        throw new ConflictException({
          error: 'CORREO_YA_INGRESADO',
          // El filtro global solo deja pasar `message` y `error`: la OV viaja en el texto
          // y la web la obtiene con GET …/ingreso.
          message: `Este pedido ya fue ingresado como ${fila.codigoOrdenVenta ?? 'una OV'}.`,
        });
      }
      // Ya lo está procesando otra llamada: no se duplica, se devuelve el estado actual.
      return aIngresoDto(fila);
    }

    this.lanzarProcesar(cuenta, ctx.schemaName, messageId, numeroIntentos);
    return aIngresoDto(fila);
  }

  async beforeApplicationShutdown(): Promise<void> {
    if (this.enVuelo.size === 0) return;
    const espera = Promise.allSettled([...this.enVuelo]).then(() => undefined);
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const tope = new Promise<void>((resolver) => {
      temporizador = setTimeout(resolver, TOPE_APAGADO_MS);
    });
    await Promise.race([espera, tope]);
    if (temporizador) clearTimeout(temporizador);
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
        error: 'INGRESO_NO_ENCONTRADO',
        message: 'Este correo todavía no se ha intentado ingresar.',
      });
    }
    return aIngresoDto(fila);
  }

  /** El correo completo para mostrarlo: cuerpo y datos de cada adjunto, sin sus bytes. */
  async contenido(
    messageId: string,
    ctx: TenantContext,
  ): Promise<CorreoContenidoResponseDto> {
    this.cuentaHabilitada(ctx);
    this.validarMessageId(messageId);
    const correo = await this.gmail.obtener(messageId);
    return {
      asunto: correo.asunto,
      de: correo.de,
      para: correo.para,
      fecha: correo.fecha,
      texto: correo.texto,
      html: correo.html,
      adjuntos: correo.adjuntos.map((adjunto, indice) => ({
        indice,
        nombre: adjunto.nombre,
        mimeType: adjunto.mimeType,
        tamano: adjunto.tamano,
      })),
    };
  }

  /** Un adjunto del correo, por su posición en `contenido().adjuntos`. */
  async adjunto(
    messageId: string,
    indice: number,
    ctx: TenantContext,
  ): Promise<AdjuntoDescargable> {
    this.cuentaHabilitada(ctx);
    this.validarMessageId(messageId);
    if (
      !Number.isInteger(indice) ||
      indice < 0 ||
      indice > INDICE_ADJUNTO_MAX
    ) {
      throw new BadRequestException({
        error: 'INDICE_ADJUNTO_INVALIDO',
        message: 'La posición del adjunto no es válida.',
      });
    }
    return this.gmail.descargarAdjunto(messageId, indice);
  }

  private lanzarProcesar(
    cuenta: string,
    schemaName: string | null,
    messageId: string,
    numeroIntentos: number,
  ): void {
    const trabajo: Promise<void> = this.procesar(
      cuenta,
      schemaName,
      messageId,
      numeroIntentos,
    ).finally(() => {
      this.enVuelo.delete(trabajo);
    });
    this.enVuelo.add(trabajo);
  }

  private async procesar(
    cuenta: string,
    schemaName: string | null,
    messageId: string,
    numeroIntentos: number,
  ): Promise<void> {
    try {
      if (numeroIntentos > 1) {
        const ovs = await this.ingresos.buscarOvsPorNumeroCorreo(
          schemaName,
          cuenta,
          messageId,
        );
        if (ovs[0]) {
          await this.ingresos.marcarIngresado({
            schemaName,
            codigoCuenta: cuenta,
            messageId,
            idOrdenVenta: ovs[0].idOrdenVenta,
            codigoOrdenVenta: ovs.map((ov) => ov.codigo).join(', '),
          });
          return;
        }
      }
      const correo = await this.gmail.obtener(messageId);
      const files: Express.Multer.File[] = [];
      for (let i = 0; i < Math.min(correo.adjuntos.length, MAX_ADJUNTOS); i++) {
        const adjunto = await this.gmail.descargarAdjunto(messageId, i);
        files.push(
          aArchivo({
            nombre: adjunto.nombre,
            mimeType: adjunto.mimeType,
            base64: adjunto.buffer.toString('base64'),
          }),
        );
      }
      const textoPedido = armarTexto({ ...correo, adjuntos: [] });
      if (!textoPedido && files.length === 0) {
        throw new BadRequestException(
          'El correo no trae texto ni adjuntos para leer.',
        );
      }
      const ov = await this.pedidoIa.ingestarPedido({
        codigoCuenta: cuenta,
        texto: textoPedido,
        files,
        numeroCorreo: messageId,
      });
      const codigos = ov.ordenes?.length
        ? ov.ordenes.map((orden) => orden.codigo).join(', ')
        : ov.codigo;
      await this.ingresos.marcarIngresado({
        schemaName,
        codigoCuenta: cuenta,
        messageId,
        idOrdenVenta: ov.ordenes?.[0]?.idOrdenVenta ?? ov.idOrdenVenta,
        codigoOrdenVenta: codigos,
      });
    } catch (causa) {
      this.logger.warn(
        `Ingreso del correo ${messageId} falló: ${mensajeDe(causa)}`,
      );
      await this.ingresos
        .marcarError({
          schemaName,
          codigoCuenta: cuenta,
          messageId,
          error: mensajeDe(causa),
        })
        .catch((falloAlGuardar: unknown) =>
          this.logger.error(
            `No se pudo guardar el error de ${messageId}: ${mensajeDe(falloAlGuardar)}`,
          ),
        );
    }
  }

  private validarMessageId(messageId: string): void {
    if (!MESSAGE_ID.test(messageId)) {
      throw new BadRequestException({
        error: 'MESSAGE_ID_INVALIDO',
        message: 'El identificador del correo no es válido.',
      });
    }
  }

  /** Solo las cuentas listadas en `N8N_CORREOS_CUENTAS` ven y ingresan estos correos. */
  private cuentaHabilitada(ctx: TenantContext): string {
    const cuenta = ctx.codigoCuenta?.trim().toUpperCase();
    const permitidas = (this.config.get<string>('N8N_CORREOS_CUENTAS') ?? '')
      .split(',')
      .map((codigo) => codigo.trim().toUpperCase())
      .filter(Boolean);
    if (!cuenta || !permitidas.includes(cuenta)) {
      throw new ForbiddenException({
        error: 'CORREOS_NO_DISPONIBLES',
        message:
          'Los correos de pedidos no están habilitados para esta cuenta.',
      });
    }
    return cuenta;
  }
}
