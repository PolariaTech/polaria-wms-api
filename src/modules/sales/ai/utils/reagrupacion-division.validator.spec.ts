import {
  construirContextoModelo,
  validarSalidaModelo,
  type EstadoBase,
  type OtBase,
} from './reagrupacion-ot.validator';
import {
  leerDivisionCruda,
  mensajeDivisionImposible,
  validarDivision,
  type DivisionCruda,
} from './reagrupacion-division.validator';

function ot(
  otId: string,
  pedido: string,
  fecha: string,
  horario: string,
  producto: string,
): OtBase {
  return {
    otId,
    etiqueta: `${pedido} — COCINA`,
    almacen: 'COCINA',
    numeroPedido: pedido,
    fecha,
    horario,
    renglones: [{ renglonId: `l-${otId}`, producto, cantidad: 10, unidad: 'KGM' }],
  };
}

/** Dos OC; la segunda se entrega otro día y a otra hora. */
const estado: EstadoBase = {
  ots: [
    ot('ot-1', '4502988065', '2026-11-07', '06:00 - 08:00', 'Aguacate'),
    ot('ot-2', '4502988065', '2026-11-07', '06:00 - 08:00', 'Limón'),
    ot('ot-3', '4502988746', '2026-11-08', '14:00 - 16:00', 'Piña'),
  ],
};

const cruda = (criterio: DivisionCruda['criterio'], valores: string[]): DivisionCruda => ({
  criterio,
  valores,
});

describe('validarDivision (REQ-262 / REQ-273)', () => {
  it('por orden de compra: saca todas las tareas de la OC indicada y deja la otra', () => {
    expect(validarDivision(cruda('oc', ['4502988746']), estado)).toEqual({
      tipo: 'division',
      division: {
        criterio: 'oc',
        valoresSalen: ['4502988746'],
        valoresQuedan: ['4502988065'],
        otIdsQueSalen: ['ot-3'],
      },
    });
  });

  it('por día de entrega: nombra los días tal como están en el estado', () => {
    expect(validarDivision(cruda('dia', ['2026-11-08']), estado)).toEqual({
      tipo: 'division',
      division: {
        criterio: 'dia',
        valoresSalen: ['2026-11-08'],
        valoresQuedan: ['2026-11-07'],
        otIdsQueSalen: ['ot-3'],
      },
    });
  });

  it('por horario de entrega: compara sin importar espacios ni mayúsculas', () => {
    const res = validarDivision(cruda('horario', [' 06:00 - 08:00 ']), estado);

    expect(res.tipo).toBe('division');
    if (res.tipo === 'division') {
      expect(res.division.otIdsQueSalen).toEqual(['ot-1', 'ot-2']);
      expect(res.division.valoresQuedan).toEqual(['14:00 - 16:00']);
    }
  });

  it('una OV de un solo día no se puede dividir por día: es imposible, no inválida', () => {
    const unDia: EstadoBase = {
      ots: [estado.ots[0], { ...estado.ots[2], fecha: '2026-11-07' }],
    };

    expect(validarDivision(cruda('dia', ['2026-11-07']), unDia)).toEqual({
      tipo: 'imposible',
      criterio: 'dia',
    });
    expect(validarDivision(cruda('oc', ['4502988746']), unDia).tipo).toBe('division');
  });

  it('las tareas sin día no cuentan como un día distinto', () => {
    const sinFecha: EstadoBase = {
      ots: [estado.ots[0], { ...estado.ots[2], fecha: '' }],
    };

    expect(validarDivision(cruda('dia', []), sinFecha)).toEqual({
      tipo: 'imposible',
      criterio: 'dia',
    });
  });

  it('una OV con una sola OC no se puede dividir por orden de compra', () => {
    const una: EstadoBase = { ots: [estado.ots[0], estado.ots[1]] };

    expect(validarDivision(cruda('oc', ['4502988065']), una)).toEqual({
      tipo: 'imposible',
      criterio: 'oc',
    });
  });

  it('otro motivo (por ejemplo sacar un producto) es imposible con el criterio «otro»', () => {
    expect(validarDivision(cruda('otro', []), estado)).toEqual({
      tipo: 'imposible',
      criterio: 'otro',
    });
    expect(validarDivision(cruda('ninguno', []), estado)).toEqual({
      tipo: 'imposible',
      criterio: 'otro',
    });
  });

  it('rechaza un valor que no existe en el estado', () => {
    expect(validarDivision(cruda('oc', ['9999']), estado)).toEqual({
      tipo: 'invalida',
      motivo: 'OT_INEXISTENTE',
    });
  });

  it('rechaza una división que no saca nada o que saca todos los valores', () => {
    expect(validarDivision(cruda('oc', []), estado).tipo).toBe('invalida');
    expect(
      validarDivision(cruda('oc', ['4502988065', '4502988746']), estado).tipo,
    ).toBe('invalida');
  });
});

describe('leerDivisionCruda', () => {
  it('sin criterio ni valores asume «ninguno» y lista vacía', () => {
    expect(leerDivisionCruda({}, false)).toEqual({ criterio: 'ninguno', valores: [] });
  });

  it('rechaza criterios desconocidos, valores que no son texto y valores fuera de una división', () => {
    expect(leerDivisionCruda({ criterio: 'producto' }, true)).toBeNull();
    expect(leerDivisionCruda({ criterio: 'oc', valoresSalen: [1] }, true)).toBeNull();
    expect(leerDivisionCruda({ criterio: 'oc', valoresSalen: ['x'] }, false)).toBeNull();
  });
});

describe('mensajeDivisionImposible', () => {
  it('dice por qué no se puede dividir según lo que pidió el operador', () => {
    expect(mensajeDivisionImposible('oc')).toContain('la misma orden de compra');
    expect(mensajeDivisionImposible('dia')).toContain('el mismo día de entrega');
    expect(mensajeDivisionImposible('horario')).toContain('el mismo horario');
    expect(mensajeDivisionImposible('otro')).toContain('por orden de compra, por día');
  });
});

describe('validarSalidaModelo con resultado "division"', () => {
  const { mapa } = construirContextoModelo(estado);
  const salida = (extra: Record<string, unknown>) => ({
    resultado: 'division',
    ots: [],
    criterio: 'oc',
    valoresSalen: ['4502988746'],
    ...extra,
  });

  it('acepta la división con criterio, valores y ots vacío', () => {
    expect(validarSalidaModelo(salida({}), estado, mapa).tipo).toBe('division');
  });

  it('un criterio que no distingue nada llega como división imposible', () => {
    const res = validarSalidaModelo(
      salida({ criterio: 'otro', valoresSalen: [] }),
      estado,
      mapa,
    );

    expect(res).toEqual({ tipo: 'division_imposible', criterio: 'otro' });
  });

  it('rechaza valores con un resultado distinto de división', () => {
    const res = validarSalidaModelo(salida({ resultado: 'rechazo' }), estado, mapa);

    expect(res).toEqual({ tipo: 'invalida', motivo: 'SALIDA_NO_VALIDA' });
  });

  it('rechaza una división que además trae OT', () => {
    const ots = [{ ot: 'OT-A', etiquetaSugerida: null, renglones: ['r1'] }];

    expect(validarSalidaModelo(salida({ ots }), estado, mapa).tipo).toBe('invalida');
  });

  it('la salida de siempre (propuesta sin criterio) sigue valiendo', () => {
    expect(
      validarSalidaModelo({ resultado: 'rechazo', ots: [] }, estado, mapa).tipo,
    ).toBe('rechazo');
    expect(
      validarSalidaModelo(
        { resultado: 'rechazo', ots: [], criterio: 'ninguno', valoresSalen: [] },
        estado,
        mapa,
      ).tipo,
    ).toBe('rechazo');
  });

  it('el modelo ve el día y el horario de cada tarea', () => {
    const { contexto } = construirContextoModelo(estado);

    expect(contexto.ots[2]).toMatchObject({
      pedido: '4502988746',
      fecha: '2026-11-08',
      horario: '14:00 - 16:00',
    });
  });
});
