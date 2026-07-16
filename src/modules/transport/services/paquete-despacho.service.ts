import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertOperationalTenantScope } from '../../../core/database/tenant-scope.util';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { CrearPaqueteDespachoDto } from '../dto/crear-paquete-despacho.dto';
import { PaqueteDespachoRepository } from '../infrastructure/paquete-despacho.repository';
import type { PaqueteDespachoResponse } from '../interfaces/transport.interfaces';

@Injectable()
export class PaqueteDespachoService {
  constructor(private readonly repository: PaqueteDespachoRepository) {}

  async crear(
    dto: CrearPaqueteDespachoDto,
    ctx: TenantContext,
  ): Promise<PaqueteDespachoResponse> {
    const codigoCuenta = dto.codigoCuenta.trim();
    const idBodega = dto.idBodega.trim();
    const idCamion = dto.idCamion.trim();
    const idOrdenesVenta = [
      ...new Set(dto.idOrdenesVenta.map((id) => id.trim()).filter(Boolean)),
    ];

    if (!ctx.idUsuario?.trim()) {
      throw new BadRequestException('Usuario no autenticado');
    }

    if (idOrdenesVenta.length === 0) {
      throw new BadRequestException(
        'Seleccioná al menos una orden de venta para el paquete',
      );
    }

    assertOperationalTenantScope(ctx, { codigoCuenta, idBodega });

    try {
      return await this.repository.crearPaquete({
        codigoCuenta,
        idBodega,
        idCamion,
        idOrdenesVenta,
        idUsuario: ctx.idUsuario,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): Error {
    const code =
      error instanceof Error ? error.message : 'PAQUETE_DESPACHO_FAILED';

    switch (code) {
      case 'CAMION_NO_ENCONTRADO':
        return new NotFoundException('No se encontró el camión indicado');
      case 'CAMION_NO_DISPONIBLE':
        return new ConflictException(
          'El camión ya no está disponible. Elegí otro.',
        );
      case 'OV_NO_ENCONTRADA':
        return new NotFoundException(
          'Una o más órdenes de venta no pertenecen a esta bodega/cuenta',
        );
      case 'SIN_ZONA_SALIDA':
        return new BadRequestException(
          'La bodega no tiene zona de salida configurada',
        );
      case 'SIN_CAJAS_EN_SALIDA':
        return new BadRequestException(
          'No hay cajas en zona de salida para despachar',
        );
      case 'OV_NOT_FOUND':
        return new NotFoundException('Orden de venta no encontrada');
      case 'OV_ESTADO_INVALIDO':
        return new ConflictException(
          'La orden de venta no está en un estado válido para despacho',
        );
      case 'DESPACHO_EXCEDE_PEDIDO':
        return new ConflictException(
          'El despacho excedería lo pedido en la orden de venta',
        );
      default:
        if (code.startsWith('OV_ESTADO_INVALIDO:')) {
          const venta = code.split(':')[1] ?? '';
          return new ConflictException(
            `La venta ${venta} no está en un estado válido para despacho`,
          );
        }
        if (code.startsWith('OV_SIN_LINEAS:')) {
          const venta = code.split(':')[1] ?? '';
          return new BadRequestException(
            `La venta ${venta} no tiene líneas de producto`,
          );
        }
        if (code.startsWith('OV_YA_EN_TRANSPORTE:')) {
          const venta = code.split(':')[1] ?? '';
          return new ConflictException(
            `La venta ${venta} ya tiene guía de transporte`,
          );
        }
        return error instanceof Error
          ? error
          : new BadRequestException('No se pudo armar el paquete de despacho');
    }
  }
}
