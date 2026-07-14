import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoSolicitudCompra } from '../../../generated/prisma/client';
import {
  applyTenantFilter,
  assertOperationalTenantScope,
} from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { CreateSolicitudCompraDto } from '../dto/create-solicitud-compra.dto';
import type { ListSolicitudesQueryDto } from '../dto/list-solicitudes-query.dto';
import type { RechazarSolicitudDto } from '../dto/rechazar-solicitud.dto';
import type { UpdateSolicitudCompraDto } from '../dto/update-solicitud-compra.dto';
import { SolicitudCompraRepository } from '../infrastructure/solicitud-compra.repository';
import type {
  SolicitudCompraLineaInput,
  SolicitudCompraResponse,
  UpdateSolicitudCompraInput,
} from '../interfaces/solicitud-compra.interfaces';

@Injectable()
export class SolicitudCompraService {
  constructor(private readonly repository: SolicitudCompraRepository) {}

  async create(
    dto: CreateSolicitudCompraDto,
    ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    const codigoCuenta = (dto.codigoCuenta ?? ctx.codigoCuenta ?? '').trim();

    if (!codigoCuenta) {
      throw new BadRequestException('No se encontró la cuenta activa');
    }

    await this.validateOperationalScope(codigoCuenta, dto.idBodega, ctx);

    const idProveedor = await this.resolveProveedorId(
      dto.idProveedor,
      codigoCuenta,
    );

    await this.validateLineas(dto.lineas, codigoCuenta);

    const solicitud = await this.repository.create(
      {
        codigoCuenta,
        idBodega: dto.idBodega,
        idProveedor,
        observaciones: dto.observaciones,
        lineas: dto.lineas,
      },
      ctx.idUsuario,
    );

    return this.repository.toResponse(solicitud);
  }

  async list(
    query: ListSolicitudesQueryDto,
    ctx: TenantContext,
  ): Promise<SolicitudCompraResponse[]> {
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
      },
      ctx,
    );

    const solicitudes = await this.repository.list(where);
    return solicitudes.map((s) => this.repository.toResponse(s));
  }

  async findById(
    idSolicitudCompra: string,
    ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    const solicitud = await this.getAccessibleSolicitud(idSolicitudCompra, ctx);
    return this.repository.toResponse(solicitud);
  }

  async update(
    idSolicitudCompra: string,
    dto: UpdateSolicitudCompraDto,
    ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    const solicitud = await this.getAccessibleSolicitud(idSolicitudCompra, ctx);
    this.assertEditable(solicitud.estado);

    if (dto.idProveedor) {
      await this.validateProveedor(dto.idProveedor, solicitud.codigoCuenta);
    }

    if (dto.lineas) {
      await this.validateLineas(dto.lineas, solicitud.codigoCuenta);
    }

    const input: UpdateSolicitudCompraInput = {
      idProveedor: dto.idProveedor,
      observaciones: dto.observaciones,
      lineas: dto.lineas,
    };

    const updated = await this.repository.update(idSolicitudCompra, input);
    return this.repository.toResponse(updated);
  }

  async enviarAprobacion(
    idSolicitudCompra: string,
    ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    const solicitud = await this.getAccessibleSolicitud(idSolicitudCompra, ctx);
    this.assertTransition(solicitud.estado, EstadoSolicitudCompra.borrador);

    if (solicitud.lineas.length === 0) {
      throw new BadRequestException(
        'La solicitud debe tener al menos una línea',
      );
    }

    if (!solicitud.idProveedor) {
      throw new BadRequestException(
        'Debe indicar un proveedor antes de enviar a aprobación',
      );
    }

    const updated = await this.repository.updateEstado(
      idSolicitudCompra,
      EstadoSolicitudCompra.pendiente_aprobacion,
    );

    return this.repository.toResponse(updated);
  }

  async aprobar(
    idSolicitudCompra: string,
    ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    const solicitud = await this.getAccessibleSolicitud(idSolicitudCompra, ctx);
    this.assertTransition(
      solicitud.estado,
      EstadoSolicitudCompra.pendiente_aprobacion,
    );

    const updated = await this.repository.updateEstado(
      idSolicitudCompra,
      EstadoSolicitudCompra.aprobada,
    );

    return this.repository.toResponse(updated);
  }

  async rechazar(
    idSolicitudCompra: string,
    dto: RechazarSolicitudDto,
    ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    const solicitud = await this.getAccessibleSolicitud(idSolicitudCompra, ctx);
    this.assertTransition(
      solicitud.estado,
      EstadoSolicitudCompra.pendiente_aprobacion,
    );

    const observaciones = dto.motivo?.trim()
      ? [solicitud.observaciones, `Rechazo: ${dto.motivo.trim()}`]
          .filter(Boolean)
          .join('\n')
      : solicitud.observaciones;

    const updated = await this.repository.updateEstado(
      idSolicitudCompra,
      EstadoSolicitudCompra.rechazada,
      observaciones,
    );

    return this.repository.toResponse(updated);
  }

  async cancelar(
    idSolicitudCompra: string,
    ctx: TenantContext,
  ): Promise<SolicitudCompraResponse> {
    const solicitud = await this.getAccessibleSolicitud(idSolicitudCompra, ctx);

    if (
      solicitud.estado !== EstadoSolicitudCompra.borrador &&
      solicitud.estado !== EstadoSolicitudCompra.pendiente_aprobacion
    ) {
      throw new BadRequestException(
        'Solo se puede cancelar una solicitud en borrador o pendiente de aprobación',
      );
    }

    const updated = await this.repository.updateEstado(
      idSolicitudCompra,
      EstadoSolicitudCompra.cancelada,
    );

    return this.repository.toResponse(updated);
  }

  private async getAccessibleSolicitud(
    idSolicitudCompra: string,
    ctx: TenantContext,
  ) {
    const solicitud = await this.repository.findById(idSolicitudCompra);

    if (!solicitud) {
      throw new NotFoundException('Solicitud de compra no encontrada');
    }

    assertOperationalTenantScope(ctx, {
      codigoCuenta: solicitud.codigoCuenta,
      idBodega: solicitud.idBodega,
    });

    return solicitud;
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

  private async resolveProveedorId(
    idProveedor: string | undefined,
    codigoCuenta: string,
  ): Promise<string> {
    if (idProveedor?.trim()) {
      await this.validateProveedor(idProveedor.trim(), codigoCuenta);
      return idProveedor.trim();
    }

    const proveedor = await this.repository.findDefaultProveedor(codigoCuenta);

    if (!proveedor) {
      throw new BadRequestException(
        'No hay proveedor activo configurado para esta cuenta',
      );
    }

    return proveedor.idProveedor;
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
    lineas: SolicitudCompraLineaInput[],
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

  private assertEditable(estado: EstadoSolicitudCompra): void {
    if (estado !== EstadoSolicitudCompra.borrador) {
      throw new BadRequestException(
        'Solo se puede editar una solicitud en borrador',
      );
    }
  }

  private assertTransition(
    estadoActual: EstadoSolicitudCompra,
    estadoEsperado: EstadoSolicitudCompra,
  ): void {
    if (estadoActual !== estadoEsperado) {
      throw new BadRequestException(
        `Transición no permitida desde estado ${estadoActual}`,
      );
    }
  }
}
