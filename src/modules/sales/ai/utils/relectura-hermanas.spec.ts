import type { OrigenCorreoRenglon } from './origen-correo-ordenes-trabajo';
import {
  evaluarHermanas,
  filtrarLeidosDeHermanas,
  MENSAJE_HERMANAS_MISMA_OC,
  MENSAJE_HERMANAS_SIN_OC,
  type HermanaRelectura,
} from './relectura-hermanas';

const renglon = (oc: string, producto = 'P'): OrigenCorreoRenglon => ({
  Producto: producto,
  'Numero pedido': oc,
});
const hermana = (codigo: string, oc: string | null): HermanaRelectura => ({
  codigo,
  ordenCompra: oc,
  origenCorreo: [renglon(oc ?? '')],
});

describe('evaluarHermanas (REQ-313)', () => {
  it('sin hermanas no filtra nada (OV que se amplía al releer)', () => {
    expect(
      evaluarHermanas({
        ordenCompra: 'A',
        antes: [renglon('A')],
        hermanas: [],
      }),
    ).toEqual({ tipo: 'libre' });
  });

  it('una hermana con otra OC deja esa OC como ajena', () => {
    const r = evaluarHermanas({
      ordenCompra: '4502993483',
      antes: [renglon('4502993483')],
      hermanas: [hermana('OV-00001690', '4502993479')],
    });
    expect(r).toEqual({
      tipo: 'filtrar',
      ocsAjenas: new Map([['4502993479', 'OV-00001690']]),
    });
  });

  it('normaliza la OC con normalizarOc (espacios y mayúsculas)', () => {
    const r = evaluarHermanas({
      ordenCompra: ' OC-1 ',
      antes: [],
      hermanas: [hermana('OV-2', 'oc-1'), hermana('OV-3', ' B  2 ')],
    });
    expect(r).toEqual({
      tipo: 'filtrar',
      ocsAjenas: new Map([['b 2', 'OV-3']]),
    });
  });

  it('toma las OC propias también de los renglones actuales', () => {
    const r = evaluarHermanas({
      ordenCompra: null,
      antes: [renglon('A')],
      hermanas: [hermana('OV-2', 'B')],
    });
    expect(r).toMatchObject({ tipo: 'filtrar' });
  });

  it('toma las OC de la hermana también de sus renglones', () => {
    const r = evaluarHermanas({
      ordenCompra: 'A',
      antes: [],
      hermanas: [
        { codigo: 'OV-2', ordenCompra: null, origenCorreo: [renglon('B')] },
      ],
    });
    expect(r).toEqual({ tipo: 'filtrar', ocsAjenas: new Map([['b', 'OV-2']]) });
  });

  it('una OV ya contaminada con la OC de su hermana se limpia, no se bloquea', () => {
    const antes = [
      ...[1, 2, 3].map((n) => renglon('4502993483', `p${n}`)),
      ...[1, 2, 3].map((n) => renglon('4502993479', `q${n}`)),
    ];
    const r = evaluarHermanas({
      ordenCompra: '4502993483',
      antes,
      hermanas: [hermana('OV-00001690', '4502993479')],
    });
    expect(r).toEqual({
      tipo: 'filtrar',
      ocsAjenas: new Map([['4502993479', 'OV-00001690']]),
    });
    if (r.tipo !== 'filtrar') return;
    const leidos = filtrarLeidosDeHermanas(antes, r.ocsAjenas);
    expect(
      leidos.renglones.every((fila) => fila['Numero pedido'] === '4502993483'),
    ).toBe(true);
    expect(leidos.renglones).toHaveLength(3);
  });

  it('sin OC propia y con hermanas bloquea', () => {
    expect(
      evaluarHermanas({
        ordenCompra: null,
        antes: [],
        hermanas: [hermana('OV-2', 'B')],
      }),
    ).toEqual({ tipo: 'bloqueo', codigo: 'HERMANAS_SIN_OC' });
  });

  it('hermanas con la misma OC (división por día) bloquea', () => {
    expect(
      evaluarHermanas({
        ordenCompra: 'A',
        antes: [renglon('A')],
        hermanas: [hermana('OV-2', 'A')],
      }),
    ).toEqual({ tipo: 'bloqueo', codigo: 'HERMANAS_MISMA_OC' });
  });

  it('los mensajes al operador no traen códigos', () => {
    expect(MENSAJE_HERMANAS_SIN_OC).toMatch(
      /sin mezclar|no tiene orden de compra/,
    );
    expect(MENSAJE_HERMANAS_MISMA_OC).toMatch(/comparte la orden de compra/);
  });
});

describe('filtrarLeidosDeHermanas (REQ-313)', () => {
  const ajenas = new Map([['b', 'OV-2']]);

  it('quita las filas de la OC ajena y conserva propias y sin OC', () => {
    const leidos = [
      renglon('A', '1'),
      renglon('B', '2'),
      renglon(' b ', '3'),
      renglon('', '4'),
    ];
    const r = filtrarLeidosDeHermanas(leidos, ajenas);
    expect(r.renglones.map((fila) => fila.Producto)).toEqual(['1', '4']);
    expect(r.omitidosPorOv.get('OV-2')).toEqual({ oc: 'b', cantidad: 2 });
  });

  it('caso real reducido: 3 filas de cada OC, quedan las 3 propias y 3 omitidos', () => {
    const leidos = [
      ...[1, 2, 3].map((n) => renglon('4502993483', `p${n}`)),
      ...[1, 2, 3].map((n) => renglon('4502993479', `q${n}`)),
    ];
    const r = filtrarLeidosDeHermanas(
      leidos,
      new Map([['4502993479', 'OV-00001690']]),
    );
    expect(r.renglones).toHaveLength(3);
    expect(
      r.renglones.every((fila) => fila['Numero pedido'] === '4502993483'),
    ).toBe(true);
    expect(r.omitidosPorOv.get('OV-00001690')?.cantidad).toBe(3);
  });

  it('si no hay nada que quitar no reporta omitidos', () => {
    const r = filtrarLeidosDeHermanas([renglon('A')], ajenas);
    expect(r.omitidosPorOv.size).toBe(0);
  });
});
