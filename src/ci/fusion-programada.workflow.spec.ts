/**
 * Prueba del workflow `.github/workflows/fusion-programada.yml`: ejecuta su script real con un `gh`
 * simulado. El arnés y la explicación de qué necesita (bash y jq) están en `__tests__/fusion-programada.arnes-spec.ts`.
 */
import {
  ejecutar,
  hayHerramientas,
  limpiarEscenarios,
  llamadasA,
  numerosDe,
  pr,
  REPO,
} from './__tests__/fusion-programada.arnes-spec';

const describeSiHayHerramientas = hayHerramientas ? describe : describe.skip;
const fusionar = (numero: number): string =>
  `pr merge ${numero} --repo ${REPO} --merge`;

afterEach(limpiarEscenarios);

describeSiHayHerramientas('fusión programada: qué PR se fusiona', () => {
  it('fusiona solo los PR que cumplen todas las condiciones', () => {
    const resultado = ejecutar({
      prs: [
        pr(1),
        pr(2, { isDraft: true }),
        pr(3, { reviewDecision: 'REVIEW_REQUIRED' }),
        pr(4, { mergeable: 'CONFLICTING' }),
        pr(5, { labels: [{ name: 'no-fusionar' }] }),
        pr(6, { statusCheckRollup: [] }),
        pr(7, { statusCheckRollup: [{ conclusion: 'FAILURE' }] }),
        pr(8, { statusCheckRollup: [{ conclusion: null }] }),
        pr(9, {
          statusCheckRollup: [
            { conclusion: 'SUCCESS' },
            { conclusion: 'SKIPPED' },
            { conclusion: 'NEUTRAL' },
            { state: 'SUCCESS' },
          ],
        }),
      ],
    });
    expect(resultado.codigo).toBe(0);
    expect(llamadasA(resultado, 'pr merge')).toEqual([
      fusionar(1),
      fusionar(9),
    ]);
  });

  it('fusiona del más antiguo al más nuevo', () => {
    const resultado = ejecutar({
      prs: [
        pr(30, { createdAt: '2026-11-05T00:00:00Z' }),
        pr(31, { createdAt: '2026-10-01T00:00:00Z' }),
        pr(32, { createdAt: '2026-11-09T00:00:00Z' }),
      ],
    });
    expect(numerosDe(resultado, 'pr merge')).toEqual(['31', '30', '32']);
  });

  it('no hace nada si ningún PR está listo', () => {
    const resultado = ejecutar({ prs: [pr(1, { isDraft: true })] });
    expect(resultado.codigo).toBe(0);
    expect(llamadasA(resultado, 'pr merge')).toEqual([]);
    expect(resultado.resumen).toContain('nada que fusionar');
  });
});

describeSiHayHerramientas('fusión programada: PR apilados y simulación', () => {
  it('al fusionar el padre reapunta a main a los PR apilados y les avisa', () => {
    const resultado = ejecutar({
      prs: [pr(10)],
      hijos: { 'dani/pr-10': [11, 12] },
    });
    expect(resultado.codigo).toBe(0);
    expect(llamadasA(resultado, 'pr edit')).toEqual([
      `pr edit 11 --repo ${REPO} --base main`,
      `pr edit 12 --repo ${REPO} --base main`,
    ]);
    expect(numerosDe(resultado, 'pr comment')).toEqual(['11', '12']);
    expect(resultado.resumen).toContain('reapuntado a main el PR apilado #11');
  });

  it('si no puede reapuntar un hijo, sigue con el otro y termina en rojo', () => {
    const resultado = ejecutar({
      prs: [pr(10)],
      hijos: { 'dani/pr-10': [11, 12] },
      fallan: ['reapuntar-11'],
    });
    expect(resultado.codigo).toBe(1);
    expect(llamadasA(resultado, 'pr edit')).toHaveLength(2);
    expect(numerosDe(resultado, 'pr comment')).toEqual(['12']);
    expect(resultado.resumen).toContain(
      'NO se pudo reapuntar el PR apilado #11',
    );
  });

  it('en simulación no fusiona, no reapunta y no comenta nada', () => {
    const resultado = ejecutar({
      prs: [pr(10)],
      hijos: { 'dani/pr-10': [11] },
      soloSimular: true,
    });
    expect(resultado.codigo).toBe(0);
    expect(llamadasA(resultado, 'pr merge')).toEqual([]);
    expect(llamadasA(resultado, 'pr edit')).toEqual([]);
    expect(llamadasA(resultado, 'pr comment')).toEqual([]);
    expect(resultado.salida).toContain('SIMULACIÓN: fusionaría el PR #10');
    expect(resultado.salida).toContain(
      'SIMULACIÓN: reapuntaría el PR apilado #11 a main',
    );
  });
});

describeSiHayHerramientas(
  'fusión programada: un PR que falla no detiene a los demás',
  () => {
    it('un PR desactualizado se avisa, no es un fallo y no se fusiona', () => {
      const resultado = ejecutar({
        prs: [pr(10), pr(11)],
        estados: { 10: 'BEHIND' },
      });
      expect(resultado.codigo).toBe(0);
      expect(llamadasA(resultado, 'pr merge')).toEqual([fusionar(11)]);
      expect(resultado.resumen).toContain('DESACTUALIZADO #10');
    });

    it('un PR con conflictos es un fallo real, pero se fusiona el siguiente', () => {
      const resultado = ejecutar({
        prs: [pr(10), pr(11)],
        estados: { 10: 'DIRTY' },
      });
      expect(resultado.codigo).toBe(1);
      expect(llamadasA(resultado, 'pr merge')).toEqual([fusionar(11)]);
      expect(resultado.resumen).toContain('CONFLICTO #10');
    });

    it('si GitHub rechaza la fusión, es un fallo real y sigue con el siguiente', () => {
      const resultado = ejecutar({
        prs: [pr(10), pr(11)],
        fallan: ['fusionar-10'],
      });
      expect(resultado.codigo).toBe(1);
      expect(llamadasA(resultado, 'pr merge')).toEqual([
        fusionar(10),
        fusionar(11),
      ]);
      expect(resultado.resumen).toContain('NO se pudo fusionar #10');
    });

    it('si no puede leer el estado de un PR, lo cuenta como fallo y sigue con el siguiente', () => {
      const resultado = ejecutar({ prs: [pr(10), pr(11)], fallan: ['ver-10'] });
      expect(resultado.codigo).toBe(1);
      expect(llamadasA(resultado, 'pr merge')).toEqual([fusionar(11)]);
      expect(resultado.resumen).toContain('NO se pudo leer el estado de #10');
      expect(resultado.resumen).toContain('fusionado #11');
    });

    it('si tras fusionar no puede listar los PR apilados, lo cuenta como fallo y sigue con el siguiente', () => {
      const resultado = ejecutar({
        prs: [pr(10), pr(11)],
        fallan: ['hijos-dani_pr-10'],
      });
      expect(resultado.codigo).toBe(1);
      expect(llamadasA(resultado, 'pr merge')).toEqual([
        fusionar(10),
        fusionar(11),
      ]);
      expect(resultado.resumen).toContain(
        'NO se pudo listar los PR apilados de #10',
      );
      expect(resultado.resumen).toContain('fusionado #11');
    });

    it('en simulación, un fallo al listar los PR apilados también cuenta y no corta la simulación', () => {
      const resultado = ejecutar({
        prs: [pr(10), pr(11)],
        fallan: ['hijos-dani_pr-10'],
        soloSimular: true,
      });
      expect(resultado.codigo).toBe(1);
      expect(resultado.salida).toContain('SIMULACIÓN: fusionaría el PR #11');
      expect(llamadasA(resultado, 'pr merge')).toEqual([]);
    });
  },
);
