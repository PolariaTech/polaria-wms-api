import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoOrdenCompra, Prisma } from '../../../generated/prisma/client';
import {
  applyTenantFilter,
  assertOperationalTenantScope,
} from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { CreateRecepcionCompraDto } from '../dto/create-recepcion-compra.dto';
import type { ListRecepcionesQueryDto } from '../dto/list-recepciones-query.dto';
import { RecepcionCompraRepository } from '../infrastructure/recepcion-compra.repository';
import type {
  RecepcionCompraResponse,
  RecepcionLineaInput,
} from '../interfaces/recepcion-compra.interfaces';
import { validarTemperaturaProducto } from '../utils/validar-temperatura-producto.util';

@Injectable()
export class RecepcionCompraService {
  constructor(private readonly repository: RecepcionCompraRepository) {}

  async cerrar(
    idOrdenCompra: string,
    dto: CreateRecepcionCompraDto,
    ctx: TenantContext,
  ): Promise<RecepcionCompraResponse> {
    if (dto.lineas.some((linea) => linea.cantidadRecibida < 0)) {
      throw new BadRequestException(
        'Las cantidades recibidas no pueden ser negativas',
      );
    }

    const orden = await this.repository.findOrdenCompra(idOrdenCompra);

    if (!orden) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    assertOperationalTenantScope(ctx, {
      codigoCuenta: orden.codigoCuenta,
      idBodega: orden.idBodega,
    });

    if (
      orden.codigoCuenta !== dto.codigoCuenta.trim() ||
      orden.idBodega !== dto.idBodega
    ) {
      throw new BadRequestException(
        'La cuenta o bodega del request no coinciden con la orden de compra',
      );
    }

    if (orden.recepcion) {
      throw new BadRequestException(
        'Esta orden de compra ya tiene recepción cerrada',
      );
    }

    if (
      orden.estado !== EstadoOrdenCompra.emitida &&
      orden.estado !== EstadoOrdenCompra.parcialmente_recibida
    ) {
      throw new BadRequestException(
        'Solo se puede recepcionar una OC emitida o parcialmente recibida',
      );
    }

    const lineasMap = new Map(
      orden.lineas.map((linea) => [linea.idLineaOrdenCompra, linea]),
    );

    const lineasNormalizadas: RecepcionLineaInput[] = [];

    for (const linea of dto.lineas) {
      const ocLinea = lineasMap.get(linea.idLineaOrdenCompra);

      if (!ocLinea) {
        throw new BadRequestException(
          `La línea ${linea.idLineaOrdenCompra} no pertenece a la orden de compra`,
        );
      }

      lineasNormalizadas.push(linea);
    }

    const idsRecibidos = new Set(
      lineasNormalizadas.map((l) => l.idLineaOrdenCompra),
    );

    if (idsRecibidos.size !== lineasNormalizadas.length) {
      throw new BadRequestException('Hay líneas de recepción duplicadas');
    }

    const lineasAdicionales = dto.lineasAdicionales ?? [];
    const sinDiferencias =
      lineasAdicionales.length === 0 &&
      orden.lineas.every((ocLinea) => {
        const recibida = lineasNormalizadas.find(
          (l) => l.idLineaOrdenCompra === ocLinea.idLineaOrdenCompra,
        );

        if (!recibida) {
          return false;
        }

        return (
          new Prisma.Decimal(recibida.cantidadRecibida).eq(ocLinea.cantidad) &&
          recibida.cantidadRecibida > 0
        );
      }) &&
      lineasNormalizadas.length === orden.lineas.length;

    const lineasActualizadas = lineasNormalizadas.map((linea) => {
      const ocLinea = lineasMap.get(linea.idLineaOrdenCompra)!;
      const totalRecibido = ocLinea.cantidadRecibida.add(
        new Prisma.Decimal(linea.cantidadRecibida),
      );

      if (totalRecibido.gt(ocLinea.cantidad)) {
        throw new BadRequestException(
          `La cantidad recibida supera lo pedido en la línea ${linea.idLineaOrdenCompra}`,
        );
      }

      return {
        idLineaOrdenCompra: linea.idLineaOrdenCompra,
        cantidadRecibida: totalRecibido,
      };
    });

    const todoRecibido = orden.lineas.every((ocLinea) => {
      const actualizada = lineasActualizadas.find(
        (l) => l.idLineaOrdenCompra === ocLinea.idLineaOrdenCompra,
      );

      if (!actualizada) {
        return ocLinea.cantidadRecibida.gte(ocLinea.cantidad);
      }

      return actualizada.cantidadRecibida.gte(ocLinea.cantidad);
    });

    const nuevoEstado = todoRecibido
      ? EstadoOrdenCompra.recibida
      : EstadoOrdenCompra.parcialmente_recibida;

    let idUbicacionIngreso = dto.idUbicacionIngreso?.trim() || undefined;

    const entradas = [
      ...lineasNormalizadas
        .filter((l) => l.cantidadRecibida > 0)
        .map((linea) => {
          const ocLinea = lineasMap.get(linea.idLineaOrdenCompra)!;
          return {
            idProducto: ocLinea.idProducto,
            cantidad: new Prisma.Decimal(linea.cantidadRecibida),
            temperatura:
              linea.temperaturaRegistrada != null
                ? new Prisma.Decimal(linea.temperaturaRegistrada)
                : undefined,
          };
        }),
      ...lineasAdicionales
        .filter((l) => l.cantidadRecibida > 0)
        .map((linea) => ({
          idProducto: linea.idProducto,
          cantidad: new Prisma.Decimal(linea.cantidadRecibida),
          temperatura:
            linea.temperaturaRegistrada != null
              ? new Prisma.Decimal(linea.temperaturaRegistrada)
              : undefined,
        })),
    ];

    let ingresoInventario:
      | {
          idUbicacionIngreso: string;
          entradas: Array<{
            idProducto: string;
            cantidad: Prisma.Decimal;
            temperatura?: Prisma.Decimal;
          }>;
        }
      | undefined;

    if (entradas.length > 0) {
      const productoIds = [...new Set(entradas.map((e) => e.idProducto))];
      const productos =
        await this.repository.findProductosRangoTemperatura(productoIds);
      const productoMap = new Map(
        productos.map((p) => [p.idProducto, p] as const),
      );

      for (const entrada of entradas) {
        if (entrada.temperatura == null) {
          throw new BadRequestException(
            'La temperatura es obligatoria para registrar inventario en recepción',
          );
        }

        const producto = productoMap.get(entrada.idProducto);
        if (!producto) {
          throw new BadRequestException(
            'Producto no encontrado en el catálogo',
          );
        }

        const tempError = validarTemperaturaProducto(
          Number(entrada.temperatura.toString()),
          producto,
        );

        if (tempError) {
          throw new BadRequestException(`${producto.sku}: ${tempError}`);
        }
      }
    }

    if (entradas.length > 0) {
      if (!idUbicacionIngreso) {
        const autoSlot = await this.repository.findNextUbicacionIngresoLibre(
          dto.idBodega,
        );

        if (!autoSlot) {
          const haySlots = await this.repository.countUbicacionesIngreso(
            dto.idBodega,
          );

          throw new BadRequestException(
            haySlots === 0
              ? 'Esta bodega no tiene slots de ingreso configurados.'
              : 'No hay slots libres en la zona de ingreso.',
          );
        }

        idUbicacionIngreso = autoSlot.idUbicacion;
      }

      const ubicacion = await this.repository.findUbicacionIngreso(
        idUbicacionIngreso,
        dto.idBodega,
      );

      if (!ubicacion) {
        throw new BadRequestException(
          'La ubicación de ingreso no existe, no es de recepción o no pertenece a la bodega',
        );
      }

      ingresoInventario = {
        idUbicacionIngreso,
        entradas,
      };
    } else if (idUbicacionIngreso) {
      throw new BadRequestException(
        'Debe recibir al menos una cantidad positiva para registrar inventario',
      );
    }

    const recepcion = await this.repository.cerrarRecepcion(
      {
        codigoCuenta: dto.codigoCuenta,
        idBodega: dto.idBodega,
        idOrdenCompra,
        lineas: lineasNormalizadas,
        lineasAdicionales,
        idUbicacionIngreso,
        notas: dto.notas,
      },
      ctx.idUsuario,
      sinDiferencias,
      nuevoEstado,
      lineasActualizadas,
      ingresoInventario,
    );

    return this.repository.toResponse(recepcion);
  }

  async list(
    query: ListRecepcionesQueryDto,
    ctx: TenantContext,
  ): Promise<RecepcionCompraResponse[]> {
    const where = applyTenantFilter(
      {
        ...(query.idBodega ? { idBodega: query.idBodega } : {}),
        ...(query.idOrdenCompra ? { idOrdenCompra: query.idOrdenCompra } : {}),
      },
      ctx,
    );

    const recepciones = await this.repository.list(where);
    return recepciones.map((r) => this.repository.toResponse(r));
  }

  async findById(
    idRecepcion: string,
    ctx: TenantContext,
  ): Promise<RecepcionCompraResponse> {
    const recepcion = await this.repository.findById(idRecepcion);

    if (!recepcion) {
      throw new NotFoundException('Recepción no encontrada');
    }

    assertOperationalTenantScope(ctx, {
      codigoCuenta: recepcion.codigoCuenta,
      idBodega: recepcion.idBodega,
    });

    return this.repository.toResponse(recepcion);
  }

  async findByOrden(
    idOrdenCompra: string,
    ctx: TenantContext,
  ): Promise<RecepcionCompraResponse> {
    const recepcion = await this.repository.findByOrdenCompra(idOrdenCompra);

    if (!recepcion) {
      throw new NotFoundException('Recepción no encontrada para esta orden');
    }

    assertOperationalTenantScope(ctx, {
      codigoCuenta: recepcion.codigoCuenta,
      idBodega: recepcion.idBodega,
    });

    return this.repository.toResponse(recepcion);
  }
}
