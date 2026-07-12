import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoOrdenVenta } from '../../../generated/prisma/client';
import {
  applyTenantFilter,
  assertOperationalTenantScope,
} from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { ListOrdenesVentaQueryDto } from '../dto/list-ordenes-venta-query.dto';
import { OrdenVentaRepository } from '../infrastructure/orden-venta.repository';
import type { OrdenVentaEmitirResponse } from '../interfaces/orden-venta.interfaces';

@Injectable()
export class OrdenVentaService {
  constructor(private readonly repository: OrdenVentaRepository) {}

  async list(
    query: ListOrdenesVentaQueryDto,
    ctx: TenantContext,
  ): Promise<OrdenVentaEmitirResponse[]> {
    assertOperationalTenantScope(ctx, {
      codigoCuenta: query.codigoCuenta,
      idBodega: query.idBodega,
    });

    const where = applyTenantFilter(
      {
        codigoCuenta: query.codigoCuenta,
        idBodega: query.idBodega,
        ...(query.paraSalida
          ? { estado: EstadoOrdenVenta.confirmada }
          : query.estado
            ? { estado: query.estado }
            : {}),
      },
      ctx,
    );

    const rows = await this.repository.list(where);
    return rows.map((row) => this.repository.toEmitirResponse(row));
  }

  async emitir(
    idOrdenVenta: string,
    ctx: TenantContext,
  ): Promise<OrdenVentaEmitirResponse> {
    const orden = await this.getAccessibleOrden(idOrdenVenta, ctx);

    if (orden.estado !== EstadoOrdenVenta.borrador) {
      throw new ConflictException(
        'Solo se pueden emitir ventas en borrador',
      );
    }

    if (orden.lineas.length === 0) {
      throw new ConflictException('La venta no tiene productos');
    }

    await this.validateEntidades(orden);

    const demandaPorProducto = new Map<string, number>();
    for (const linea of orden.lineas) {
      const actual = demandaPorProducto.get(linea.idProducto) ?? 0;
      demandaPorProducto.set(
        linea.idProducto,
        actual + linea.cantidadPedida.toNumber(),
      );
    }

    for (const [idProducto, cantidad] of demandaPorProducto) {
      const disponible = await this.repository.getDisponibleProducto(
        orden.codigoCuenta,
        orden.idBodega,
        idProducto,
      );

      if (disponible.lt(cantidad)) {
        const linea = orden.lineas.find((l) => l.idProducto === idProducto);
        const nombre =
          linea?.producto.descripcion ?? linea?.producto.sku ?? 'producto';
        throw new ConflictException(
          `No hay stock suficiente para ${nombre}. Disponible: ${disponible.toNumber()} kg`,
        );
      }
    }

    try {
      return await this.repository.emitir(orden, ctx.idUsuario);
    } catch (error) {
      this.mapEmitirError(error);
    }
  }

  private async getAccessibleOrden(
    idOrdenVenta: string,
    ctx: TenantContext,
  ) {
    const orden = await this.repository.findById(idOrdenVenta);

    if (!orden) {
      throw new NotFoundException('No se encontró la orden de venta');
    }

    assertOperationalTenantScope(ctx, {
      codigoCuenta: orden.codigoCuenta,
      idBodega: orden.idBodega,
    });

    return orden;
  }

  private async validateEntidades(
    orden: NonNullable<Awaited<ReturnType<OrdenVentaRepository['findById']>>>,
  ): Promise<void> {
    if (!orden.bodega.estaActiva) {
      throw new ForbiddenException('La bodega está inactiva');
    }

    if (!orden.cliente.estaActivo) {
      throw new BadRequestException('El cliente no está activo');
    }

    if (orden.comprador && !orden.comprador.estaActivo) {
      throw new BadRequestException('El comprador no está activo');
    }

    if (orden.idBodegaDestino && orden.bodegaDestino && !orden.bodegaDestino.estaActiva) {
      throw new BadRequestException('La bodega destino no está activa');
    }

    for (const linea of orden.lineas) {
      if (!linea.producto.estaActivo) {
        throw new BadRequestException(
          `El producto ${linea.producto.descripcion} no está activo`,
        );
      }
    }
  }

  private mapEmitirError(error: unknown): never {
    if (error instanceof Error) {
      if (error.message === 'OV_ESTADO_INVALIDO') {
        throw new ConflictException(
          'Solo se pueden emitir ventas en borrador',
        );
      }

      if (error.message === 'UBICACION_DESTINO_NOT_FOUND') {
        throw new ConflictException(
          'No hay slots libres en la zona de destino para despachar la venta',
        );
      }

      if (error.message.startsWith('STOCK_INSUFICIENTE|')) {
        const [, nombre, disponible] = error.message.split('|');
        throw new ConflictException(
          `No hay stock suficiente para ${nombre}. Disponible: ${disponible} kg`,
        );
      }
    }

    throw error;
  }
}
