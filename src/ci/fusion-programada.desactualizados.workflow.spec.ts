/**
 * Prueba del workflow `.github/workflows/fusion-programada.yml`, parte de los PR desactualizados:
 * el robot actualiza la rama con main, lanza el CI y espera. El arnés y la explicación de qué necesita
 * (bash y jq) están en `__tests__/fusion-programada.arnes-spec.ts`.
 */
import {
  ejecutar,
  hayHerramientas,
  limpiarEscenarios,
  llamadasA,
  pr,
  REPO,
} from './__tests__/fusion-programada.arnes-spec';

const describeSiHayHerramientas = hayHerramientas ? describe : describe.skip;
const fusionar = (numero: number): string =>
  `pr merge ${numero} --repo ${REPO} --merge`;

afterEach(limpiarEscenarios);

describeSiHayHerramientas(
  'fusión programada: PR desactualizados (el robot actualiza la rama)',
  () => {
    const actualizar = (numero: number): string =>
      `pr update-branch ${numero} --repo ${REPO}`;
    const lanzarCi = (rama: string): string =>
      `workflow run ci.yml --repo ${REPO} --ref ${rama}`;

    it('actualiza la rama, lanza el CI, espera a que termine y fusiona', () => {
      const resultado = ejecutar({
        prs: [pr(10)],
        estados: { 10: 'BEHIND' },
        comprobaciones: { 10: ['pendiente', 'pendiente', 'verde'] },
      });
      expect(resultado.codigo).toBe(0);
      const secuencia = resultado.llamadas.filter(
        (llamada) =>
          llamada.startsWith('pr update-branch') ||
          llamada.startsWith('workflow run') ||
          llamada.startsWith('pr merge'),
      );
      expect(secuencia).toEqual([
        actualizar(10),
        lanzarCi('dani/pr-10'),
        fusionar(10),
      ]);
      expect(resultado.resumen).toContain(
        'rama de #10 actualizada con main y comprobaciones en verde',
      );
    });

    it('no toca un PR que ya está al día', () => {
      const resultado = ejecutar({ prs: [pr(10)] });
      expect(llamadasA(resultado, 'pr update-branch')).toEqual([]);
      expect(llamadasA(resultado, 'workflow run')).toEqual([]);
      expect(llamadasA(resultado, 'pr merge')).toEqual([fusionar(10)]);
    });

    it('si el CI sale en rojo tras actualizar: fallo real, no se fusiona y sigue con el siguiente', () => {
      const resultado = ejecutar({
        prs: [pr(10), pr(11)],
        estados: { 10: 'BEHIND' },
        comprobaciones: { 10: ['pendiente', 'rojo'] },
      });
      expect(resultado.codigo).toBe(1);
      expect(llamadasA(resultado, 'pr merge')).toEqual([fusionar(11)]);
      expect(resultado.resumen).toContain('CI EN ROJO #10');
    });

    it('si el CI no termina a tiempo: queda en espera, no es un fallo y no se fusiona', () => {
      const resultado = ejecutar({
        prs: [pr(10), pr(11)],
        estados: { 10: 'BEHIND' },
        comprobaciones: { 10: ['pendiente'] },
      });
      expect(resultado.codigo).toBe(0);
      expect(llamadasA(resultado, 'pr merge')).toEqual([fusionar(11)]);
      expect(resultado.resumen).toContain('EN ESPERA #10');
      expect(resultado.resumen).toContain(
        'En espera para la próxima ejecución: 1',
      );
    });

    it('si no se ve un commit nuevo tras actualizar: fallo real y no lanza el CI', () => {
      const resultado = ejecutar({
        prs: [pr(10), pr(11)],
        estados: { 10: 'BEHIND' },
        sinCommitNuevo: [10],
      });
      expect(resultado.codigo).toBe(1);
      expect(llamadasA(resultado, 'workflow run')).toEqual([]);
      expect(llamadasA(resultado, 'pr merge')).toEqual([fusionar(11)]);
      expect(resultado.resumen).toContain(
        'NO se pudo actualizar la rama de #10',
      );
    });

    it('si GitHub no puede actualizar la rama (conflicto): fallo real y no lanza el CI', () => {
      const resultado = ejecutar({
        prs: [pr(10)],
        estados: { 10: 'BEHIND' },
        fallan: ['actualizar-10'],
      });
      expect(resultado.codigo).toBe(1);
      expect(llamadasA(resultado, 'workflow run')).toEqual([]);
      expect(llamadasA(resultado, 'pr merge')).toEqual([]);
    });

    it('si no puede lanzar el CI: fallo real y no se fusiona', () => {
      const resultado = ejecutar({
        prs: [pr(10)],
        estados: { 10: 'BEHIND' },
        fallan: ['lanzar-ci'],
      });
      expect(resultado.codigo).toBe(1);
      expect(llamadasA(resultado, 'pr merge')).toEqual([]);
    });

    it('si no queda tiempo en la ejecución: queda en espera sin tocar la rama', () => {
      const resultado = ejecutar({
        prs: [pr(10)],
        estados: { 10: 'BEHIND' },
        presupuesto: -1,
      });
      expect(resultado.codigo).toBe(0);
      expect(llamadasA(resultado, 'pr update-branch')).toEqual([]);
      expect(llamadasA(resultado, 'pr merge')).toEqual([]);
      expect(resultado.resumen).toContain('EN ESPERA #10');
    });

    it('en simulación avisa de que actualizaría la rama, pero no la toca', () => {
      const resultado = ejecutar({
        prs: [pr(10)],
        estados: { 10: 'BEHIND' },
        soloSimular: true,
      });
      expect(resultado.codigo).toBe(0);
      expect(resultado.salida).toContain(
        'SIMULACIÓN: antes actualizaría la rama del PR #10',
      );
      expect(llamadasA(resultado, 'pr update-branch')).toEqual([]);
      expect(llamadasA(resultado, 'workflow run')).toEqual([]);
    });
  },
);
