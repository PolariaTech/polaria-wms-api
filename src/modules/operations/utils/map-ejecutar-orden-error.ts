import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { OrdenVentaEstadoError } from '../../sales/utils/orden-venta-estado.util';
import { mapOrdenVentaOvError } from '../../sales/utils/map-orden-venta-ov-error';

export function mapEjecutarOrdenError(error: unknown): never {
  if (error instanceof OrdenVentaEstadoError) {
    mapOrdenVentaOvError(error);
  }

  if (error instanceof Error) {
    switch (error.message) {
      case 'WAREHOUSE_STATE_NOT_FOUND':
        throw new NotFoundException(
          'No hay stock en el slot origen para ejecutar la orden',
        );
      case 'WAREHOUSE_STATE_AMBIGUOUS':
        throw new BadRequestException(
          'Hay varias posiciones en el slot origen; especifique lote o producto en la orden',
        );
      case 'WAREHOUSE_STATE_VERSION_CONFLICT':
        throw new ConflictException(
          'La posición fue modificada por otro usuario',
        );
      case 'UBICACION_DESTINO_REQUIRED':
        throw new BadRequestException(
          'La orden requiere ubicación destino para mover stock',
        );
      case 'UBICACION_DESTINO_NOT_FOUND':
        throw new BadRequestException(
          'No hay slots libres en la zona de salida',
        );
      case 'CANTIDAD_INSUFICIENTE_EN_SLOT':
        throw new BadRequestException(
          'No hay suficiente stock en el slot origen para la cantidad de la orden',
        );
      case 'CANTIDAD_INVALIDA':
        throw new BadRequestException(
          'La orden no tiene una cantidad válida para mover',
        );
    }
  }
  throw error;
}
