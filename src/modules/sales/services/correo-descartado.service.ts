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
  CorreosListaResponseDto,
} from '../dto/correos-response.dto';
import type { IngresoCorreoResponseDto } from '../dto/ingreso-correo-response.dto';
import {
  CorreoIngresoRepository,
  type CorreoIngresoFila,
} from '../infrastructure/correo-ingreso.repository';
import { N8nCorreosClient } from '../infrastructure/n8n-correos.client';
import { aArchivo, armarTexto, mensajeDe } from './correo-descartado.texto';
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

const aDto = (fila: CorreoIngresoFila): IngresoCorreoResponseDto => ({
  messageId: fila.messageId,
  estado: fila.estado,
  idOrdenVenta: fila.idOrdenVenta,
  codigoOrdenVenta: fila.codigoOrdenVenta,
  error: fila.error,
});

/**
 * REQ-104: lista los correos que n8n registró en Supabase (POL-410: ya no pasa por el Puente
 * de n8n), deja ver un correo completo (ese sí se lee en Gmail vía n8n) y permite al
 * operador ingresar a mano como OV los que el workflow descartó. El ingreso es asíncrono (la
 * lectura con IA pasa de los 30 s del proxy de Next): reserva la fila, responde 202 y termina
 * en segundo plano; la web consulta el estado hasta que pase a `ingresado` o `error`.
 */
@Injectable()
export class CorreoDescartadoService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(CorreoDescartadoService.name);
  private readonly enVuelo = new Set<Promise<void>>();

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
      filas: filas.map((fila) => {
        const ingreso = porId.get(fila.messageId);
        return {
          ...fila,
          codigoOrdenVenta:
            fila.codigoOrdenVenta ??
            (ingreso?.estado === 'ingresado' ? ingreso.codigoOrdenVenta : null),
          ingreso: ingreso ? aDto(ingreso) : null,
        };
      }),
    };
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
      return aDto(fila);
    }

    this.lanzarProcesar(cuenta, ctx.schemaName, messageId, numeroIntentos);
    return aDto(fila);
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
    return aDto(fila);
  }

  /** El correo completo para mostrarlo: cuerpo y datos de cada adjunto, sin sus bytes. */
  async contenido(
    messageId: string,
    ctx: TenantContext,
  ): Promise<CorreoContenidoResponseDto> {
    this.cuentaHabilitada(ctx);
    this.validarMessageId(messageId);
    const correo = await this.n8n.obtener(messageId);
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
        tamano: Buffer.byteLength(adjunto.base64, 'base64'),
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
    const correo = await this.n8n.obtener(messageId);
    const adjunto = correo.adjuntos[indice];
    if (!adjunto) {
      throw new NotFoundException({
        error: 'ADJUNTO_NO_ENCONTRADO',
        message: 'El correo no tiene un adjunto en esa posición.',
      });
    }
    return {
      nombre: adjunto.nombre,
      mimeType: adjunto.mimeType,
      buffer: Buffer.from(adjunto.base64, 'base64'),
    };
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
