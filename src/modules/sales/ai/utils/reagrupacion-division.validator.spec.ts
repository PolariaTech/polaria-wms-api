import {
  construirContextoModelo,
  validarSalidaModelo,
  type EstadoBase,
} from './reagrupacion-ot.validator';
import { validarDivision } from './reagrupacion-division.validator';

const estado: EstadoBase = {
  ots: [
    {
      otId: 'ot-1',
      etiqueta: 'OC 1',
      almacen: 'COCINA',
      numeroPedido: '4502988065',
      renglones: [
        { renglonId: 'l-1', producto: 'Aguacate', cantidad: 10, unidad: 'KGM' },
      ],
    },
    {
      otId: 'ot-2',
      etiqueta: 'OC 1 bar',
      almacen: 'BAR',
      numeroPedido: '4502988065',
      renglones: [
        { renglonId: 'l-2', producto: 'Limón', cantidad: 4, unidad: 'KGM' },
      ],
    },
    {
      otId: 'ot-3',
      etiqueta: 'OC 2',
      almacen: 'COCINA',
      numeroPedido: '4502988746',
      renglones: [
        { renglonId: 'l-3', producto: 'Piña', cantidad: 8, unidad: 'KGM' },
      ],
    },
  ],
};

describe('validarDivision (REQ-262 / REQ-273)', () => {
  it('saca todas las OT de la OC indicada y deja la otra', () => {
    const res = validarDivision(['4502988746'], estado);

    expect(res).toEqual({
      tipo: 'division',
      division: {
        ocSalen: ['4502988746'],
        ocQuedan: ['4502988065'],
        otIdsQueSalen: ['ot-3'],
      },
    });
  });

  it('compara la OC sin importar espacios ni mayúsculas', () => {
    const res = validarDivision([' 4502988065 '], estado);

    expect(res.tipo).toBe('division');
    if (res.tipo === 'division') {
      expect(res.division.otIdsQueSalen).toEqual(['ot-1', 'ot-2']);
    }
  });

  it('rechaza una OC que no existe en el estado', () => {
    expect(validarDivision(['9999'], estado)).toEqual({
      tipo: 'invalida',
      motivo: 'OT_INEXISTENTE',
    });
  });

  it('rechaza una división que no saca nada o que saca todas las OC', () => {
    expect(validarDivision([], estado).tipo).toBe('invalida');
    expect(validarDivision(['4502988065', '4502988746'], estado).tipo).toBe(
      'invalida',
    );
  });

  it('rechaza dividir una OV con una sola OC', () => {
    const una: EstadoBase = { ots: [estado.ots[0], estado.ots[1]] };

    expect(validarDivision(['4502988065'], una).tipo).toBe('invalida');
  });
});

describe('validarSalidaModelo con resultado "division"', () => {
  const { mapa } = construirContextoModelo(estado);

  it('acepta la división con ocSalen y ots vacío', () => {
    const res = validarSalidaModelo(
      { resultado: 'division', ots: [], ocSalen: ['4502988746'] },
      estado,
      mapa,
    );

    expect(res.tipo).toBe('division');
  });

  it('rechaza ocSalen con un resultado distinto de división', () => {
    const res = validarSalidaModelo(
      { resultado: 'rechazo', ots: [], ocSalen: ['4502988746'] },
      estado,
      mapa,
    );

    expect(res).toEqual({ tipo: 'invalida', motivo: 'SALIDA_NO_VALIDA' });
  });

  it('rechaza una división que además trae OT', () => {
    const res = validarSalidaModelo(
      {
        resultado: 'division',
        ots: [{ ot: 'OT-A', etiquetaSugerida: null, renglones: ['r1'] }],
        ocSalen: ['4502988746'],
      },
      estado,
      mapa,
    );

    expect(res.tipo).toBe('invalida');
  });

  it('sigue aceptando la salida de dos campos de siempre', () => {
    const res = validarSalidaModelo(
      { resultado: 'rechazo', ots: [] },
      estado,
      mapa,
    );

    expect(res.tipo).toBe('rechazo');
  });
});
