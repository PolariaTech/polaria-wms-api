import { Injectable } from '@nestjs/common';
import {
  EstadoProcesamiento,
  EstadoTarea,
  EstadoOrdenTrabajo,
  Prisma,
  TipoLineaOt,
  TipoOrdenTrabajo,
  TipoTarea,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  buildObservacionesOtProcesamiento,
  buildObservacionesOtAProcesamiento,
  buildTareaProcesamientoDescripcion,
  buildTareaSolicitudDescripcion,
  parseObservacionesOtProcesamiento,
} from '../constants/procesamiento-tarea.constants';
import {
  CONTADOR_CLAVE_SOLICITUD_PROCESAMIENTO,
  formatCodigoSolicitudProcesamiento,
} from '../constants/processing.constants';
import type {
  CerrarSolicitudProcesamientoInput,
  CreateSolicitudProcesamientoInput,
  SolicitudProcesamientoResponse,
} from '../interfaces/processing.interfaces';
import { ProcesamientoInventarioRepository } from './procesamiento-inventario.repository';
import { OrdenTrabajoRepository } from '../../operations/infrastructure/orden-trabajo.repository';
import {
  estimadoSecundarioAplicarPerdidaPct,
  normalizePerdidaPct,
  unidadesSecundarioEnterasParaMapa,
  unidadesSecundarioPorRegla,
} from '../utils/catalogo-procesamiento.util';
import { kgSobranteParaDevolucionMapa, sobranteKgTotalTrasEnCurso } from '../utils/sobrante-kg.util';

export type SolicitudRow = Prisma.SolicitudProcesamientoGetPayload<object>;

interface ProductoProcesamientoCtx {
  idProducto: string;
  mermaPct: Prisma.Decimal | null;
  unidadVisualizacion: string;
  reglaConversionCantidadPrimario: Prisma.Decimal | null;
  reglaConversionUnidadesSecundario: Prisma.Decimal | null;
}

@Injectable()
export class SolicitudProcesamientoRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventario: ProcesamientoInventarioRepository,
    private readonly ordenTrabajoRepository: OrdenTrabajoRepository,
  ) {}

  list(where: Prisma.SolicitudProcesamientoWhereInput): Promise<SolicitudRow[]> {
    return this.prisma.solicitudProcesamiento.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<SolicitudRow | null> {
    return this.prisma.solicitudProcesamiento.findUnique({
      where: { idSolicitudProcesamiento: id },
    });
  }

  findTareaVinculada(
    idSolicitud: string,
    codigoCuenta: string,
    idBodega: string,
  ) {
    return this.prisma.tareaCola.findFirst({
      where: {
        codigoCuenta,
        idBodega,
        tipo: TipoTarea.procesamiento,
        OR: [
          { idSolicitudProcesamiento: idSolicitud },
          {
            descripcion: {
              contains: `solicitudProcesamiento:${idSolicitud}`,
            },
          },
          { descripcion: buildTareaSolicitudDescripcion(idSolicitud) },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    input: CreateSolicitudProcesamientoInput,
    idSolicitante: string,
  ): Promise<SolicitudRow> {
    const [primario, secundario] = await Promise.all([
      this.loadProducto(input.idProductoPrimario, input.codigoCuenta),
      this.loadProducto(input.idProductoSecundario, input.codigoCuenta),
    ]);

    const reglaA =
      input.reglaConversionCantidadPrimario ??
      Number(secundario.reglaConversionCantidadPrimario ?? 1);
    const reglaB =
      input.reglaConversionUnidadesSecundario ??
      Number(secundario.reglaConversionUnidadesSecundario ?? 0);
    const perdidaPct = normalizePerdidaPct(
      input.perdidaProcesamientoPct ?? Number(secundario.mermaPct ?? 0),
    );

    const teorico = unidadesSecundarioPorRegla(
      input.kilosPrimario,
      reglaA,
      reglaB,
    );
    const estimado = estimadoSecundarioAplicarPerdidaPct(teorico, perdidaPct);

    const stockDisponible = await this.inventario.sumDisponibleAlmacenamiento({
      codigoCuenta: input.codigoCuenta,
      idBodega: input.idBodega,
      idProducto: input.idProductoPrimario,
    });

    if (stockDisponible < input.kilosPrimario) {
      throw new Error('STOCK_INSUFICIENTE');
    }

    return this.prisma.$transaction(async (tx) => {
      const codigo = await this.nextCodigo(tx, input.codigoCuenta, input.idBodega);

      return tx.solicitudProcesamiento.create({
        data: {
          codigoCuenta: input.codigoCuenta,
          idBodega: input.idBodega,
          codigo,
          idCliente: input.idCliente ?? null,
          idProductoPrimario: input.idProductoPrimario,
          idProductoSecundario: input.idProductoSecundario,
          idSolicitante,
          estado: EstadoProcesamiento.pendiente,
          kilosPrimario: new Prisma.Decimal(input.kilosPrimario),
          reglaConversionCantidadPrimario: new Prisma.Decimal(reglaA),
          reglaConversionUnidadesSecundario: new Prisma.Decimal(reglaB),
          perdidaProcesamientoPct: new Prisma.Decimal(perdidaPct),
          estimadoUnidadesSecundario:
            estimado != null ? new Prisma.Decimal(estimado) : null,
          observaciones: input.observaciones?.trim() || null,
        },
      });
    });
  }

  async asignarOperario(
    solicitud: SolicitudRow,
    idOperario: string,
    idSolicitante: string,
  ): Promise<SolicitudRow> {
    const existingTarea = await this.findTareaVinculada(
      solicitud.idSolicitudProcesamiento,
      solicitud.codigoCuenta,
      solicitud.idBodega,
    );

    if (existingTarea) {
      throw new Error('TAREA_YA_EXISTE');
    }

    const kilosPrimario = Number(solicitud.kilosPrimario.toString());
    const productoPrimario = await this.prisma.producto.findFirst({
      where: {
        idProducto: solicitud.idProductoPrimario,
        codigoCuenta: solicitud.codigoCuenta,
      },
      select: { descripcion: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const origen = await this.inventario.resolverSlotOrigenFifo(tx, {
        codigoCuenta: solicitud.codigoCuenta,
        idBodega: solicitud.idBodega,
        idProducto: solicitud.idProductoPrimario,
        kilosRequeridos: kilosPrimario,
      });

      if (!origen) {
        throw new Error('STOCK_INSUFICIENTE');
      }

      const idUbicacionDestino = await this.inventario.resolverSlotProcesamientoLibre(
        tx,
        {
          codigoCuenta: solicitud.codigoCuenta,
          idBodega: solicitud.idBodega,
        },
      );

      if (!idUbicacionDestino) {
        throw new Error('SLOT_PROCESAMIENTO_NO_DISPONIBLE');
      }

      const codigoOt = await this.nextCodigoOt(
        tx,
        solicitud.codigoCuenta,
        solicitud.idBodega,
      );

      const observaciones = buildObservacionesOtAProcesamiento(
        solicitud.idSolicitudProcesamiento,
      );

      const orden = await tx.ordenTrabajo.create({
        data: {
          codigoCuenta: solicitud.codigoCuenta,
          idBodega: solicitud.idBodega,
          codigo: codigoOt,
          tipo: TipoOrdenTrabajo.transformacion,
          estado: EstadoOrdenTrabajo.planificada,
          idSolicitante,
          idAsignado: idOperario,
          idUbicacionOrigen: origen.idUbicacion,
          idUbicacionDestino,
          idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento,
          observaciones,
          lineas: {
            create: {
              idProducto: solicitud.idProductoPrimario,
              idUbicacion: origen.idUbicacion,
              tipoLinea: TipoLineaOt.salida,
              cantidad: new Prisma.Decimal(kilosPrimario),
            },
          },
        },
      });

      const titulo = `${solicitud.codigo} · ${productoPrimario?.descripcion ?? 'Primario'}`;
      const descripcion = buildTareaProcesamientoDescripcion(
        solicitud.idSolicitudProcesamiento,
        kilosPrimario,
      );

      await tx.tareaCola.create({
        data: {
          codigoCuenta: solicitud.codigoCuenta,
          idBodega: solicitud.idBodega,
          tipo: TipoTarea.procesamiento,
          estado: EstadoTarea.pendiente,
          idAsignado: idOperario,
          idOrdenTrabajo: orden.idOrdenTrabajo,
          idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento,
          titulo,
          descripcion,
        },
      });

      return tx.solicitudProcesamiento.update({
        where: { idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento },
        data: { idOperario },
      });
    });
  }

  async iniciarEnCurso(
    solicitud: SolicitudRow,
    idOrdenTrabajo: string,
    idProcesador: string | null,
    idUsuario: string,
  ): Promise<SolicitudRow> {
    const primario = await this.loadProducto(
      solicitud.idProductoPrimario,
      solicitud.codigoCuenta,
    );
    const kilosPrimario = Number(solicitud.kilosPrimario.toString());
    const unidad = primario.unidadVisualizacion;

    const orden = await this.ordenTrabajoRepository.findById(idOrdenTrabajo);

    if (!orden) {
      throw new Error('OT_NOT_FOUND');
    }

    let kgDescontado = solicitud.kgPrimarioDescontado
      ? Number(solicitud.kgPrimarioDescontado.toString())
      : 0;

    if (orden.estado !== EstadoOrdenTrabajo.completada) {
      try {
        await this.ordenTrabajoRepository.ejecutar(
          orden,
          {
            codigoCuenta: solicitud.codigoCuenta,
            idBodega: solicitud.idBodega,
          },
          idUsuario,
          { autoResolverStock: true, skipCompletarTarea: true },
        );
        kgDescontado = kilosPrimario;
      } catch {
        throw new Error('STOCK_INSUFICIENTE');
      }
    } else if (kgDescontado <= 0) {
      kgDescontado = kilosPrimario;
    }

    if (kgDescontado <= 0) {
      throw new Error('STOCK_INSUFICIENTE');
    }

    const estimado = solicitud.estimadoUnidadesSecundario
      ? Number(solicitud.estimadoUnidadesSecundario.toString())
      : null;

    const sobrante = sobranteKgTotalTrasEnCurso({
      unidadPrimarioVisualizacion: unidad,
      cantidadPrimario: kilosPrimario,
      deductedKg: kgDescontado,
      estimadoUnidadesSecundario: estimado,
      reglaCantidadPrimario: Number(
        solicitud.reglaConversionCantidadPrimario?.toString() ?? 1,
      ),
      reglaUnidadesSecundario: Number(
        solicitud.reglaConversionUnidadesSecundario?.toString() ?? 0,
      ),
    });

    return this.prisma.solicitudProcesamiento.update({
      where: { idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento },
      data: {
        estado: EstadoProcesamiento.en_proceso,
        idProcesador: idProcesador,
        kgPrimarioDescontado: new Prisma.Decimal(kgDescontado),
        sobranteKg: new Prisma.Decimal(sobrante),
      },
    });
  }

  asignarProcesador(
    id: string,
    idProcesador: string,
  ): Promise<SolicitudRow> {
    return this.prisma.solicitudProcesamiento.update({
      where: { idSolicitudProcesamiento: id },
      data: { idProcesador },
    });
  }

  cambiarEstado(
    id: string,
    estado: EstadoProcesamiento,
  ): Promise<SolicitudRow> {
    return this.prisma.solicitudProcesamiento.update({
      where: { idSolicitudProcesamiento: id },
      data: { estado },
    });
  }

  async cerrar(
    solicitud: SolicitudRow,
    input: CerrarSolicitudProcesamientoInput,
    idUsuario: string,
  ): Promise<SolicitudRow> {
    const estimado = solicitud.estimadoUnidadesSecundario
      ? Number(solicitud.estimadoUnidadesSecundario.toString())
      : 0;
    const kilosSecundario =
      input.kilosSecundario ??
      unidadesSecundarioEnterasParaMapa(estimado);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.solicitudProcesamiento.update({
        where: { idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento },
        data: {
          estado: EstadoProcesamiento.pendiente_cierre,
          kilosSecundario: new Prisma.Decimal(kilosSecundario),
          kilosMerma: new Prisma.Decimal(input.kilosMerma),
          cierreDesdeProcesador: true,
        },
      });

      await tx.registroMerma.create({
        data: {
          idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento,
          idBodega: solicitud.idBodega,
          codigoCuenta: solicitud.codigoCuenta,
          kilosMerma: new Prisma.Decimal(input.kilosMerma),
          periodo: new Date(),
        },
      });

      if (input.kilosMerma > 0) {
        await this.inventario.registrarMermaProcesamiento(tx, {
          codigoCuenta: solicitud.codigoCuenta,
          idBodega: solicitud.idBodega,
          idProductoPrimario: solicitud.idProductoPrimario,
          kilosMerma: input.kilosMerma,
          idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento,
          idUsuario,
        });
      }

      await tx.tareaCola.updateMany({
        where: {
          OR: [
            { idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento },
            {
              descripcion: buildTareaSolicitudDescripcion(
                solicitud.idSolicitudProcesamiento,
              ),
            },
            {
              descripcion: {
                contains: `solicitudProcesamiento:${solicitud.idSolicitudProcesamiento}`,
              },
            },
          ],
          estado: EstadoTarea.en_proceso,
        },
        data: { estado: EstadoTarea.completada, idAsignado: idUsuario },
      });

      return updated;
    });
  }

  async terminar(
    solicitud: SolicitudRow,
  ): Promise<SolicitudRow> {
    return this.prisma.solicitudProcesamiento.update({
      where: { idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento },
      data: {
        estado: EstadoProcesamiento.terminada,
        cierreDesdeProcesador: false,
      },
    });
  }

  async crearOrdenesPostCierre(
    solicitud: SolicitudRow,
    idSolicitante: string,
    idUbicacionDestinoProcesado?: string,
    idUbicacionDestinoDesperdicio?: string,
  ): Promise<{ ordenProcesadoId: string | null; ordenDesperdicioId: string | null }> {
    const primario = await this.loadProducto(
      solicitud.idProductoPrimario,
      solicitud.codigoCuenta,
    );
    const sobrante = kgSobranteParaDevolucionMapa({
      sobranteKg: solicitud.sobranteKg
        ? Number(solicitud.sobranteKg.toString())
        : 0,
      unidadPrimarioVisualizacion: primario.unidadVisualizacion,
    });

    const unidades = unidadesSecundarioEnterasParaMapa(
      solicitud.estimadoUnidadesSecundario
        ? Number(solicitud.estimadoUnidadesSecundario.toString())
        : 0,
    );

    return this.prisma.$transaction(async (tx) => {
      let ordenProcesadoId: string | null = null;
      let ordenDesperdicioId: string | null = null;

      if (unidades > 0 && idUbicacionDestinoProcesado) {
        const codigo = await this.nextCodigoOt(
          tx,
          solicitud.codigoCuenta,
          solicitud.idBodega,
        );
        const orden = await tx.ordenTrabajo.create({
          data: {
            codigoCuenta: solicitud.codigoCuenta,
            idBodega: solicitud.idBodega,
            codigo,
            tipo: TipoOrdenTrabajo.transformacion,
            idSolicitante,
            idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento,
            idUbicacionDestino: idUbicacionDestinoProcesado,
            observaciones: buildObservacionesOtProcesamiento(
              'procesado',
              solicitud.idSolicitudProcesamiento,
            ),
            lineas: {
              create: {
                idProducto: solicitud.idProductoSecundario,
                idUbicacion: idUbicacionDestinoProcesado,
                tipoLinea: TipoLineaOt.entrada,
                cantidad: new Prisma.Decimal(unidades),
              },
            },
          },
        });
        ordenProcesadoId = orden.idOrdenTrabajo;

        await tx.tareaCola.create({
          data: {
            codigoCuenta: solicitud.codigoCuenta,
            idBodega: solicitud.idBodega,
            tipo: TipoTarea.movimiento,
            estado: EstadoTarea.pendiente,
            idOrdenTrabajo: orden.idOrdenTrabajo,
            titulo: `Procesado · ${solicitud.codigo}`,
            descripcion: buildObservacionesOtProcesamiento(
              'procesado',
              solicitud.idSolicitudProcesamiento,
            ),
          },
        });
      }

      if (sobrante > 0 && idUbicacionDestinoDesperdicio) {
        const codigo = await this.nextCodigoOt(
          tx,
          solicitud.codigoCuenta,
          solicitud.idBodega,
        );
        const orden = await tx.ordenTrabajo.create({
          data: {
            codigoCuenta: solicitud.codigoCuenta,
            idBodega: solicitud.idBodega,
            codigo,
            tipo: TipoOrdenTrabajo.reabasto,
            idSolicitante,
            idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento,
            idUbicacionDestino: idUbicacionDestinoDesperdicio,
            observaciones: buildObservacionesOtProcesamiento(
              'desperdicio',
              solicitud.idSolicitudProcesamiento,
            ),
            lineas: {
              create: {
                idProducto: solicitud.idProductoPrimario,
                idUbicacion: idUbicacionDestinoDesperdicio,
                tipoLinea: TipoLineaOt.entrada,
                cantidad: new Prisma.Decimal(sobrante),
              },
            },
          },
        });
        ordenDesperdicioId = orden.idOrdenTrabajo;

        await tx.tareaCola.create({
          data: {
            codigoCuenta: solicitud.codigoCuenta,
            idBodega: solicitud.idBodega,
            tipo: TipoTarea.movimiento,
            estado: EstadoTarea.pendiente,
            idOrdenTrabajo: orden.idOrdenTrabajo,
            titulo: `Sobrante · ${solicitud.codigo}`,
            descripcion: buildObservacionesOtProcesamiento(
              'desperdicio',
              solicitud.idSolicitudProcesamiento,
            ),
          },
        });
      }

      return { ordenProcesadoId, ordenDesperdicioId };
    });
  }

  async ejecutarOtProcesamiento(
    idOrdenTrabajo: string,
    idUsuario: string,
  ): Promise<void> {
    const orden = await this.prisma.ordenTrabajo.findUnique({
      where: { idOrdenTrabajo },
      include: { lineas: true },
    });

    if (!orden?.idSolicitudProcesamiento) return;

    const meta = parseObservacionesOtProcesamiento(orden.observaciones);
    if (!meta) return;

    const solicitud = await this.findById(orden.idSolicitudProcesamiento);
    if (!solicitud) return;

    await this.prisma.$transaction(async (tx) => {
      if (meta.rol === 'procesado' && orden.idUbicacionDestino) {
        const unidades = unidadesSecundarioEnterasParaMapa(
          solicitud.estimadoUnidadesSecundario
            ? Number(solicitud.estimadoUnidadesSecundario.toString())
            : 0,
        );
        await this.inventario.ubicarSecundarioProcesado(tx, {
          codigoCuenta: solicitud.codigoCuenta,
          idBodega: solicitud.idBodega,
          idProductoSecundario: solicitud.idProductoSecundario,
          idUbicacionDestino: orden.idUbicacionDestino,
          unidades,
          idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento,
          idUsuario,
        });
      }

      if (meta.rol === 'desperdicio' && orden.idUbicacionDestino) {
        const primario = await this.loadProducto(
          solicitud.idProductoPrimario,
          solicitud.codigoCuenta,
        );
        const sobrante = kgSobranteParaDevolucionMapa({
          sobranteKg: solicitud.sobranteKg
            ? Number(solicitud.sobranteKg.toString())
            : 0,
          unidadPrimarioVisualizacion: primario.unidadVisualizacion,
        });
        await this.inventario.devolverSobrantePrimario(tx, {
          codigoCuenta: solicitud.codigoCuenta,
          idBodega: solicitud.idBodega,
          idProductoPrimario: solicitud.idProductoPrimario,
          idUbicacionDestino: orden.idUbicacionDestino,
          sobranteKg: sobrante,
          idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento,
          idUsuario,
        });
      }

      await this.tryMarcarTerminada(tx, solicitud);
    });
  }

  private async tryMarcarTerminada(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudRow,
  ): Promise<void> {
    if (solicitud.estado !== EstadoProcesamiento.pendiente_cierre) return;

    const primario = await this.loadProducto(
      solicitud.idProductoPrimario,
      solicitud.codigoCuenta,
    );
    const sobrante = kgSobranteParaDevolucionMapa({
      sobranteKg: solicitud.sobranteKg
        ? Number(solicitud.sobranteKg.toString())
        : 0,
      unidadPrimarioVisualizacion: primario.unidadVisualizacion,
    });

    const unidades = unidadesSecundarioEnterasParaMapa(
      solicitud.estimadoUnidadesSecundario
        ? Number(solicitud.estimadoUnidadesSecundario.toString())
        : 0,
    );

    const okProcesado =
      unidades <= 0 ||
      (await this.inventario.tieneSecundarioUbicado(tx, {
        idBodega: solicitud.idBodega,
        idProductoSecundario: solicitud.idProductoSecundario,
        unidadesMinimas: unidades,
      }));

    const otsPendientes = await tx.ordenTrabajo.count({
      where: {
        idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento,
        estado: { in: [EstadoOrdenTrabajo.planificada, EstadoOrdenTrabajo.en_proceso] },
      },
    });

    const okSobrante = sobrante <= 0 || otsPendientes === 0;

    if (okProcesado && okSobrante) {
      await tx.solicitudProcesamiento.update({
        where: { idSolicitudProcesamiento: solicitud.idSolicitudProcesamiento },
        data: {
          estado: EstadoProcesamiento.terminada,
          cierreDesdeProcesador: false,
        },
      });
    }
  }

  private async loadProducto(
    idProducto: string,
    codigoCuenta: string,
  ): Promise<ProductoProcesamientoCtx> {
    const row = await this.prisma.producto.findFirst({
      where: { idProducto, codigoCuenta },
      select: {
        idProducto: true,
        mermaPct: true,
        unidadVisualizacion: true,
        reglaConversionCantidadPrimario: true,
        reglaConversionUnidadesSecundario: true,
      },
    });

    if (!row) {
      throw new Error('PRODUCTO_NOT_FOUND');
    }

    return row;
  }

  private async nextCodigo(
    tx: Prisma.TransactionClient,
    codigoCuenta: string,
    idBodega: string,
  ): Promise<string> {
    const existing = await tx.contador.findFirst({
      where: {
        codigoCuenta,
        idBodega,
        clave: CONTADOR_CLAVE_SOLICITUD_PROCESAMIENTO,
      },
    });

    if (existing) {
      const updated = await tx.contador.update({
        where: { idContador: existing.idContador },
        data: { valor: { increment: 1 } },
      });
      return formatCodigoSolicitudProcesamiento(updated.valor);
    }

    const created = await tx.contador.create({
      data: {
        codigoCuenta,
        idBodega,
        clave: CONTADOR_CLAVE_SOLICITUD_PROCESAMIENTO,
        valor: 1n,
      },
    });
    return formatCodigoSolicitudProcesamiento(created.valor);
  }

  private async nextCodigoOt(
    tx: Prisma.TransactionClient,
    codigoCuenta: string,
    idBodega: string,
  ): Promise<string> {
    const clave = 'orden_trabajo';
    const existing = await tx.contador.findFirst({
      where: { codigoCuenta, idBodega, clave },
    });

    if (existing) {
      const updated = await tx.contador.update({
        where: { idContador: existing.idContador },
        data: { valor: { increment: 1 } },
      });
      return `OT-${String(updated.valor).padStart(6, '0')}`;
    }

    const created = await tx.contador.create({
      data: { codigoCuenta, idBodega, clave, valor: 1n },
    });
    return `OT-${String(created.valor).padStart(6, '0')}`;
  }

  toResponse(row: SolicitudRow): SolicitudProcesamientoResponse {
    return {
      idSolicitudProcesamiento: row.idSolicitudProcesamiento,
      codigoCuenta: row.codigoCuenta,
      idBodega: row.idBodega,
      codigo: row.codigo,
      idCliente: row.idCliente,
      idProductoPrimario: row.idProductoPrimario,
      idProductoSecundario: row.idProductoSecundario,
      idSolicitante: row.idSolicitante,
      idOperario: row.idOperario,
      idProcesador: row.idProcesador,
      estado: row.estado,
      kilosPrimario: row.kilosPrimario.toString(),
      kilosSecundario: row.kilosSecundario?.toString() ?? null,
      kilosMerma: row.kilosMerma?.toString() ?? null,
      sobranteKg: row.sobranteKg?.toString() ?? null,
      reglaConversionCantidadPrimario:
        row.reglaConversionCantidadPrimario?.toString() ?? null,
      reglaConversionUnidadesSecundario:
        row.reglaConversionUnidadesSecundario?.toString() ?? null,
      perdidaProcesamientoPct: row.perdidaProcesamientoPct?.toString() ?? null,
      estimadoUnidadesSecundario: row.estimadoUnidadesSecundario?.toString() ?? null,
      kgPrimarioDescontado: row.kgPrimarioDescontado?.toString() ?? null,
      cierreDesdeProcesador: row.cierreDesdeProcesador,
      observaciones: row.observaciones,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
