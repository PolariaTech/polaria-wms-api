import { Prisma } from '../../../generated/prisma/client';

/** Umbral global frio: > 5 °C = alta temperatura en bodega fría. */
export const TEMPERATURA_MAX_DEFAULT_FRIO_C = 5;

export interface ProductoRangoTemperatura {
  rangoTemperaturaMin: Prisma.Decimal | null;
  rangoTemperaturaMax: Prisma.Decimal | null;
}

export function validarTemperaturaProducto(
  temperatura: number,
  producto: ProductoRangoTemperatura,
): string | null {
  const min = producto.rangoTemperaturaMin
    ? Number(producto.rangoTemperaturaMin.toString())
    : null;
  const max = producto.rangoTemperaturaMax
    ? Number(producto.rangoTemperaturaMax.toString())
    : TEMPERATURA_MAX_DEFAULT_FRIO_C;

  if (min != null && temperatura < min) {
    return `La temperatura ${temperatura}°C está por debajo del mínimo permitido (${min}°C)`;
  }

  if (max != null && temperatura > max) {
    return `La temperatura ${temperatura}°C supera el máximo permitido (${max}°C)`;
  }

  return null;
}
