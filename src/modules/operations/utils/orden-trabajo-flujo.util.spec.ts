import {
  buildObservacionesFlujo,
  parseTipoFlujo,
} from './orden-trabajo-flujo.util';

describe('orden-trabajo-flujo.util', () => {
  it('parseTipoFlujo extrae flujo base', () => {
    expect(parseTipoFlujo('flujo:a_bodega|nota')).toBe('a_bodega');
    expect(parseTipoFlujo('flujo:bodega_a_bodega')).toBe('bodega_a_bodega');
    expect(parseTipoFlujo('flujo:a_salida')).toBe('a_salida');
    expect(parseTipoFlujo('flujo:revisar')).toBe('revisar');
    expect(parseTipoFlujo('otro texto')).toBeNull();
  });

  it('buildObservacionesFlujo concatena notas', () => {
    expect(buildObservacionesFlujo('a_bodega')).toBe('flujo:a_bodega');
    expect(buildObservacionesFlujo('revisar', 'conteo cíclico')).toBe(
      'flujo:revisar|conteo cíclico',
    );
  });
});
