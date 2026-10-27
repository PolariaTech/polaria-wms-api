import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EstadoOrdenVenta } from '../../../generated/prisma/client';
import { assertOperationalTenantScope } from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import {
  OpenAiReagrupacionClient,
  type RespuestaModeloReagrupacion,
} from '../ai/openai-reagrupacion.client';
import {
  calcularBaseHash,
  construirContextoModelo,
  validarEstadoBase,
  validarSalidaModelo,
  type EstadoBase,
  type MotivoRechazo,
  type ResultadoSalidaModelo,
} from '../ai/utils/reagrupacion-ot.validator';
import type {
  PropuestaReagrupacionBodyDto,
  PropuestaReagrupacionResponseDto,
} from '../dto/propuesta-reagrupacion.dto';
import { OrdenVentaRepository } from '../infrastructure/orden-venta.repository';

/** Una llamada más si la primera salida del modelo no pasa el validador (R7, M6). */
const MAX_INTENTOS_MODELO = 2;

const MENSAJE_ACLARACION =
  'No quedó claro cómo reorganizar las órdenes de trabajo. Reformula la instrucción indicando qué OT o renglones mover.';
const MENSAJE_SIN_CAMBIOS =
  'La instrucción no cambia la distribución actual de las órdenes de trabajo.';

/**
 * Propone (sin escribir nada) una nueva distribución de las OT de una OV
 * `por_confirmar`. El modelo solo mueve renglones; el validador decide (POL-390).
 */
@Injectable()
export class OrdenTrabajoReagrupacionService {
  private readonly logger = new Logger(OrdenTrabajoReagrupacionService.name);

  constructor(
    private readonly repository: OrdenVentaRepository,
    private readonly llm: OpenAiReagrupacionClient,
  ) {}

  async proponer(
    idOrdenVenta: string,
    body: PropuestaReagrupacionBodyDto,
    ctx: TenantContext,
  ): Promise<PropuestaReagrupacionResponseDto> {
    const inicio = Date.now();

    // 1. La OV se carga por id dentro del schema del tenant del JWT (R2, R3).
    const orden = await this.repository.findById(idOrdenVenta, ctx.schemaName);
    if (!orden) throw this.noEncontrada();

    // Una OV de otra cuenta responde igual que una inexistente (CA2).
    try {
      assertOperationalTenantScope(ctx, {
        codigoCuenta: orden.codigoCuenta,
        idBodega: orden.idBodega,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw this.noEncontrada();
      throw error;
    }

    // 2. Solo en por_confirmar, antes de gastar una llamada al modelo (R4, CA3).
    if (orden.estado !== EstadoOrdenVenta.por_confirmar) {
      throw new ConflictException({
        message: 'La orden de venta ya no está por confirmar.',
        error: 'OV_ESTADO_CAMBIO',
      });
    }

    // 3. Estructura del borrador que manda el cliente.
    const estadoBase: EstadoBase = {
      ots: body.estadoBase.ots.map((ot) => ({
        otId: ot.otId,
        etiqueta: ot.etiqueta,
        almacen: ot.almacen,
        numeroPedido: ot.numeroPedido,
        renglones: ot.renglones.map((r) => ({
          renglonId: r.renglonId,
          producto: r.producto,
          cantidad: r.cantidad,
          unidad: r.unidad ?? null,
        })),
      })),
    };
    const problema = validarEstadoBase(estadoBase);
    if (problema) {
      throw new BadRequestException({
        message: 'La estructura de órdenes de trabajo no es válida.',
        error: 'ESTADO_BASE_INVALIDO',
      });
    }

    const { contexto, mapa } = construirContextoModelo(estadoBase);
    const historial = (body.historial ?? []).map((h) => h.instruccion);

    // 4. Modelo + validador, con un reintento si la salida no es aceptable.
    let resultado: ResultadoSalidaModelo = {
      tipo: 'invalida',
      motivo: 'SALIDA_NO_VALIDA',
    };
    let correccion: MotivoRechazo | undefined;
    let ultimo: RespuestaModeloReagrupacion | null = null;
    let intentos = 0;

    while (intentos < MAX_INTENTOS_MODELO) {
      intentos += 1;
      try {
        ultimo = await this.llm.proponer({
          contexto,
          instruccion: body.instruccion,
          historial,
          correccion,
        });
      } catch {
        this.registrar({
          idOrdenVenta,
          requestId: body.requestId,
          resultado: 'error_proveedor',
          intentos,
          inicio,
          longitudInstruccion: body.instruccion.length,
        });
        throw new BadGatewayException({
          message: 'No se pudo consultar a la IA. Intenta de nuevo.',
          error: 'PROVEEDOR_IA',
        });
      }

      resultado = validarSalidaModelo(ultimo.salida, estadoBase, mapa);
      if (resultado.tipo !== 'invalida') break;
      correccion = resultado.motivo;
    }

    const meta = {
      idOrdenVenta,
      requestId: body.requestId,
      intentos,
      inicio,
      longitudInstruccion: body.instruccion.length,
      modelo: ultimo?.modelo,
      tokensEntrada: ultimo?.tokensEntrada,
      tokensSalida: ultimo?.tokensSalida,
    };

    if (resultado.tipo === 'invalida') {
      this.registrar({
        ...meta,
        resultado: 'invalida',
        motivo: resultado.motivo,
      });
      throw new UnprocessableEntityException({
        message:
          'La IA no devolvió una propuesta válida. Intenta reformular la instrucción.',
        error: 'PROPUESTA_INVALIDA',
      });
    }

    this.registrar({ ...meta, resultado: resultado.tipo });

    if (resultado.tipo === 'aclaracion') {
      return { requestId: body.requestId, aclaracion: MENSAJE_ACLARACION };
    }
    if (resultado.tipo === 'rechazo') {
      return { requestId: body.requestId, rechazo: 'FUERA_DE_ALCANCE' };
    }
    if (resultado.tipo === 'sin_cambios') {
      return { requestId: body.requestId, aclaracion: MENSAJE_SIN_CAMBIOS };
    }

    return {
      requestId: body.requestId,
      propuestaId: randomUUID(),
      baseHash: calcularBaseHash(estadoBase),
      ots: resultado.propuesta.ots,
      resumen: resultado.propuesta.resumen,
      movimientos: resultado.propuesta.movimientos,
    };
  }

  private noEncontrada(): NotFoundException {
    return new NotFoundException('No se encontró la orden de venta');
  }

  /** Solo metadatos: nunca la instrucción ni la respuesta cruda del modelo (R12). */
  private registrar(datos: {
    idOrdenVenta: string;
    requestId: string;
    resultado: string;
    intentos: number;
    inicio: number;
    longitudInstruccion: number;
    motivo?: string;
    modelo?: string;
    tokensEntrada?: number | null;
    tokensSalida?: number | null;
  }): void {
    const { inicio, ...resto } = datos;
    this.logger.log(
      JSON.stringify({
        evento: 'reagrupacion_ot',
        ...resto,
        latenciaMs: Date.now() - inicio,
      }),
    );
  }
}
