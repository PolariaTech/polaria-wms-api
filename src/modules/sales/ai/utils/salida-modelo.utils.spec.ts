import { clavesExactas, esObjetoPlano } from './salida-modelo.utils';

describe('salida-modelo.utils', () => {
  it('esObjetoPlano acepta objetos y rechaza null, listas y valores simples', () => {
    expect(esObjetoPlano({ a: 1 })).toBe(true);
    expect(esObjetoPlano(null)).toBe(false);
    expect(esObjetoPlano([])).toBe(false);
    expect(esObjetoPlano('texto')).toBe(false);
  });

  it('clavesExactas exige las mismas claves, en cualquier orden', () => {
    expect(clavesExactas({ b: 1, a: 2 }, ['a', 'b'])).toBe(true);
    expect(clavesExactas({ a: 1 }, ['a', 'b'])).toBe(false);
    expect(clavesExactas({ a: 1, b: 2, c: 3 }, ['a', 'b'])).toBe(false);
  });
});
