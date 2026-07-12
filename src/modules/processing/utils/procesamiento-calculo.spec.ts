import {
  estimadoSecundarioAplicarPerdidaPct,
  unidadesSecundarioEnterasParaMapa,
  unidadesSecundarioPorRegla,
} from './catalogo-procesamiento.util';
import { desperdicioKgSugeridoDesdeMerma } from './desperdicio-kg-sugerido.util';
import { sobranteKgTotalTrasEnCurso } from './sobrante-kg.util';

describe('catalogo-procesamiento.util', () => {
  it('regla de tres', () => {
    expect(unidadesSecundarioPorRegla(60, 1, 10)).toBe(600);
  });

  it('aplica merma al estimado', () => {
    expect(estimadoSecundarioAplicarPerdidaPct(100, 5)).toBe(95);
  });

  it('unidades enteras para mapa', () => {
    expect(unidadesSecundarioEnterasParaMapa(2.576)).toBe(2);
  });
});

describe('sobrante-kg.util', () => {
  it('calcula sobrante tras en curso', () => {
    const total = sobranteKgTotalTrasEnCurso({
      unidadPrimarioVisualizacion: 'peso',
      cantidadPrimario: 60.5,
      deductedKg: 60.5,
      estimadoUnidadesSecundario: 572.4,
      reglaCantidadPrimario: 1,
      reglaUnidadesSecundario: 10,
    });
    expect(total).toBeGreaterThanOrEqual(0);
  });
});

describe('desperdicio-kg-sugerido.util', () => {
  it('sugiere merma desde % catálogo', () => {
    expect(
      desperdicioKgSugeridoDesdeMerma({
        cantidadPrimario: 100,
        unidadPrimarioVisualizacion: 'peso',
        perdidaProcesamientoPct: 5,
      }),
    ).toBe(5);
  });
});
