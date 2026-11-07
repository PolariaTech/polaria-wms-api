import {
  MAX_TEXTO_REAGRUPACION,
  sanitizarTextoCorto,
} from './sanitizar-texto-corto';

describe('sanitizarTextoCorto', () => {
  it('quita marcado y caracteres de control, colapsa espacios y recorta', () => {
    const limpio = sanitizarTextoCorto(`  <b>Hola</b>\u0000\n\n mundo ${'x'.repeat(200)}`);

    expect(limpio.startsWith('bHola/b mundo')).toBe(true);
    expect(Array.from(limpio)).toHaveLength(MAX_TEXTO_REAGRUPACION);
  });

  it('devuelve vacío si no es texto', () => {
    expect(sanitizarTextoCorto(42)).toBe('');
    expect(sanitizarTextoCorto(null)).toBe('');
  });
});
