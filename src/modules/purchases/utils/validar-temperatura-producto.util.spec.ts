import {
  TEMPERATURA_MAX_DEFAULT_FRIO_C,
  validarTemperaturaProducto,
} from './validar-temperatura-producto.util';

describe('validarTemperaturaProducto', () => {
  it('acepta temperatura dentro del rango del producto', () => {
    expect(
      validarTemperaturaProducto(-18, {
        rangoTemperaturaMin: null,
        rangoTemperaturaMax: null,
      }),
    ).toBeNull();
  });

  it('rechaza por encima del máximo default frio (5°C)', () => {
    const error = validarTemperaturaProducto(6, {
      rangoTemperaturaMin: null,
      rangoTemperaturaMax: null,
    });
    expect(error).toContain(String(TEMPERATURA_MAX_DEFAULT_FRIO_C));
  });

  it('respeta rango explícito del producto', () => {
    expect(
      validarTemperaturaProducto(-20, {
        rangoTemperaturaMin: { toString: () => '-25' } as never,
        rangoTemperaturaMax: { toString: () => '-15' } as never,
      }),
    ).toBeNull();
  });
});
