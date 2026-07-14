import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrdenVentaEstadoError } from './orden-venta-estado.util';

export function mapOrdenVentaOvError(error: unknown): never {
  if (error instanceof OrdenVentaEstadoError) {
    switch (error.message) {
      case 'OV_NOT_FOUND':
        throw new NotFoundException(
          'No se encontró la orden de venta vinculada',
        );
      case 'OV_ESTADO_INVALIDO':
        throw new ConflictException(
          'La orden de venta no está en un estado válido para esta operación',
        );
      case 'OV_LINEA_NO_ENCONTRADA':
        throw new BadRequestException(
          'El producto despachado no corresponde a la orden de venta',
        );
      case 'DESPACHO_EXCEDE_PEDIDO':
        throw new ConflictException(
          'La cantidad despachada supera la cantidad pedida en la orden de venta',
        );
    }
  }

  throw error;
}
