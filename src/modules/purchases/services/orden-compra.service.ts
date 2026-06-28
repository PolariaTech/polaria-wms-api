import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DestinoTipo,
  EstadoOrdenCompra,
  EstadoSolicitudCompra,
  Prisma,
} from '../../../generated/prisma/client';
import {
  applyTenantFilter,
  assertOperationalTenantScope,
} from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { CreateOrdenCompraDto } from '../dto/create-orden-compra.dto';
import type { ListOrdenesQueryDto } from '../dto/list-ordenes-query.dto';
import { OrdenCompraRepository } from '../infrastructure/orden-compra.repository';
import { SolicitudCompraRepository } from '../infrastructure/solicitud-compra.repository';
import type {
  ConvertirSolicitudExtras,
  CreateOrdenCompraInput,
  OrdenCompraLineaInput,
  OrdenCompraResponse,
} from '../interfaces/orden-compra.interfaces';

@Injectable()
export class OrdenCompraService {
  constructor(
    private readonly repository: OrdenCompraRepository,
    private readonly solicitudRepository: SolicitudCompraRepository,
  ) {}

  async create(
    dto: CreateOrdenCompraDto,
    ctx: TenantContext,
  ): Promise<OrdenCompraResponse> {
    if (dto.idSolicitudCompra) {
      const solicitud = await this.solicitudRepository.findById(
        dto.idSolicitudCompra,
      );

      if (!solicitud) {
        throw new NotFoundException('Solicitud de compra no encontrada');
      }

      if (dto.codigoCuenta.trim() !== solicitud.codigoCuenta) {
        throw new BadRequestException(
          'La cuenta no coincide con la solicitud indicada',
        );
      }

      if (dto.idBodega !== solicitud.idBodega) {
        throw new BadRequestException(
          'La bodega no coincide con la solicitud indicada',
        );
      }

      return this.convertirDesdeSolicitud(
        dto.idSolicitudCompra,
        ctx,
        {
          fechaEntregaEstimada: dto.fechaEntregaEstimada
            ? new Date(dto.fechaEntregaEstimada)
            : undefined,
          destinoTipo: dto.destinoTipo,
          observaciones: dto.observaciones,
        },
        dto.lineas,
      );
    }

    if (!dto.idProveedor || !dto.lineas?.length) {
      throw new BadRequestException(
        'Debe indicar proveedor y al menos una línea',
      );
    }

    await this.validateOperationalScope(dto.codigoCuenta, dto.idBodega, ctx);
    await this.validateProveedor(dto.idProveedor, dto.codigoCuenta);
    await this.validateLineas(dto.lineas, dto.codigoCuenta);

    const input: CreateOrdenCompraInput = {
      codigoCuenta: dto.codigoCuenta.trim(),
      idBodega: dto.idBodega,
      idProveedor: dto.idProveedor,
      fechaEntregaEstimada: dto.fechaEntregaEstimada
        ? new Date(dto.fechaEntregaEstimada)
        : undefined,
      destinoTipo: dto.destinoTipo ?? DestinoTipo.interna,
      observaciones: dto.observaciones,
      lineas: dto.lineas,
    };

    const orden = await this.repository.create(input, ctx.idUsuario);
    return this.repository.toResponse(orden);
  }

  async list(
    query: ListOrdenesQueryDto,
    ctx: TenantContext,
  ): Promise<OrdenCompraResponse[]> {
    if (query.idBodega) {
      assertOperationalTenantScope(ctx, {
        codigoCuenta: ctx.codigoCuenta ?? '',
        idBodega: query.idBodega,
      });
    }

    const where = applyTenantFilter(
      {
        ...(query.idBodega ? { idBodega: query.idBodega } : {}),
        ...(query.estado ? { estado: query.estado } : {}),
        ...(query.idProveedor ? { idProveedor: query.idProveedor } : {}),
        ...(query.idSolicitudCompra
          ? { idSolicitudCompra: query.idSolicitudCompra }
          : {}),
      },
      ctx,
    );

    const ordenes = await this.repository.list(where);
    return ordenes.map((orden) => this.repository.toResponse(orden));
  }

  async findById(
    idOrdenCompra: string,
    ctx: TenantContext,
  ): Promise<OrdenCompraResponse> {
    const orden = await this.getAccessibleOrden(idOrdenCompra, ctx);
    return this.repository.toResponse(orden);
  }

  async emitir(
    idOrdenCompra: string,
    ctx: TenantContext,
  ): Promise<OrdenCompraResponse> {
    const orden = await this.getAccessibleOrden(idOrdenCompra, ctx);
    this.assertTransition(orden.estado, EstadoOrdenCompra.borrador);

    if (orden.lineas.length === 0) {
      throw new BadRequestException(
        'La orden debe tener al menos una línea para emitirse',
      );
    }

    const updated = await this.repository.updateEstado(
      idOrdenCompra,
      EstadoOrdenCompra.emitida,
    );

    return this.repository.toResponse(updated);
  }

  async cancelar(
    idOrdenCompra: string,
    ctx: TenantContext,
  ): Promise<OrdenCompraResponse> {
    const orden = await this.getAccessibleOrden(idOrdenCompra, ctx);

    if (
      orden.estado !== EstadoOrdenCompra.borrador &&
      orden.estado !== EstadoOrdenCompra.emitida
    ) {
      throw new BadRequestException(
        'Solo se puede cancelar una orden en borrador o emitida',
      );
    }

    const updated = await this.repository.updateEstado(
      idOrdenCompra,
      EstadoOrdenCompra.cancelada,
    );

    return this.repository.toResponse(updated);
  }

  async convertirDesdeSolicitud(
    idSolicitudCompra: string,
    ctx: TenantContext,
    extras?: ConvertirSolicitudExtras,
    lineasOverride?: OrdenCompraLineaInput[],
  ): Promise<OrdenCompraResponse> {
    const solicitud =
      await this.solicitudRepository.findById(idSolicitudCompra);

    if (!solicitud) {
      throw new NotFoundException('Solicitud de compra no encontrada');
    }

    assertOperationalTenantScope(ctx, {
      codigoCuenta: solicitud.codigoCuenta,
      idBodega: solicitud.idBodega,
    });

    this.assertSolicitudConvertible(solicitud);

    if (lineasOverride?.length) {
      await this.validateLineas(lineasOverride, solicitud.codigoCuenta);
    }

    const lineas = lineasOverride?.length
      ? lineasOverride.map((linea) => ({
          idProducto: linea.idProducto,
          cantidad: new Prisma.Decimal(linea.cantidad),
        }))
      : solicitud.lineas.map((linea) => ({
          idProducto: linea.idProducto,
          cantidad: linea.cantidad,
        }));

    if (lineas.length === 0) {
      throw new BadRequestException(
        'La solicitud debe tener al menos una línea para convertir',
      );
    }

    const orden = await this.repository.convertSolicitudToOrden(
      {
        idSolicitudCompra: solicitud.idSolicitudCompra,
        codigoCuenta: solicitud.codigoCuenta,
        idBodega: solicitud.idBodega,
        idProveedor: solicitud.idProveedor!,
        observaciones: solicitud.observaciones,
        lineas,
      },
      ctx.idUsuario,
      extras,
    );

    return this.repository.toResponse(orden);
  }

  private async getAccessibleOrden(idOrdenCompra: string, ctx: TenantContext) {
    const orden = await this.repository.findById(idOrdenCompra);

    if (!orden) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    assertOperationalTenantScope(ctx, {
      codigoCuenta: orden.codigoCuenta,
      idBodega: orden.idBodega,
    });

    return orden;
  }

  private assertSolicitudConvertible(solicitud: {
    estado: EstadoSolicitudCompra;
    idOrdenCompra: string | null;
    idProveedor: string | null;
  }): void {
    if (solicitud.estado !== EstadoSolicitudCompra.aprobada) {
      throw new BadRequestException(
        'Solo se puede convertir una solicitud aprobada',
      );
    }

    if (solicitud.idOrdenCompra) {
      throw new BadRequestException(
        'La solicitud ya fue convertida a una orden de compra',
      );
    }

    if (!solicitud.idProveedor) {
      throw new BadRequestException(
        'La solicitud debe tener proveedor para convertirse',
      );
    }
  }

  private async validateOperationalScope(
    codigoCuenta: string,
    idBodega: string,
    ctx: TenantContext,
  ): Promise<void> {
    assertOperationalTenantScope(ctx, { codigoCuenta, idBodega });

    const bodega = await this.repository.findBodega(idBodega);

    if (!bodega) {
      throw new NotFoundException('Bodega no encontrada');
    }

    if (!bodega.estaActiva) {
      throw new ForbiddenException('La bodega está inactiva');
    }

    if (bodega.codigoCuenta !== codigoCuenta) {
      throw new BadRequestException(
        'La bodega no pertenece a la cuenta indicada',
      );
    }
  }

  private async validateProveedor(
    idProveedor: string,
    codigoCuenta: string,
  ): Promise<void> {
    const proveedor = await this.repository.findProveedor(idProveedor);

    if (!proveedor) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    if (proveedor.codigoCuenta !== codigoCuenta) {
      throw new BadRequestException(
        'El proveedor no pertenece a la cuenta indicada',
      );
    }

    if (!proveedor.estaActivo) {
      throw new ForbiddenException('El proveedor está inactivo');
    }
  }

  private async validateLineas(
    lineas: OrdenCompraLineaInput[],
    codigoCuenta: string,
  ): Promise<void> {
    const productoIds = lineas.map((linea) => linea.idProducto);
    const uniqueIds = new Set(productoIds);

    if (uniqueIds.size !== productoIds.length) {
      throw new BadRequestException('Hay productos duplicados en las líneas');
    }

    const productos = await this.repository.findProductos([...uniqueIds]);

    if (productos.length !== uniqueIds.size) {
      throw new NotFoundException('Uno o más productos no existen');
    }

    for (const producto of productos) {
      if (producto.codigoCuenta !== codigoCuenta) {
        throw new BadRequestException(
          'Uno o más productos no pertenecen a la cuenta indicada',
        );
      }

      if (!producto.estaActivo) {
        throw new ForbiddenException('Uno o más productos están inactivos');
      }
    }
  }

  private assertTransition(
    estadoActual: EstadoOrdenCompra,
    estadoEsperado: EstadoOrdenCompra,
  ): void {
    if (estadoActual !== estadoEsperado) {
      throw new BadRequestException(
        `Transición no permitida desde estado ${estadoActual}`,
      );
    }
  }
}
