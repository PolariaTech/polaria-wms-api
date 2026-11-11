import type { OrigenCorreoRenglon } from './origen-correo-ordenes-trabajo';
import {
  aplicarDiferencias,
  calcularDiferencias,
  motivoDeDiferencia,
} from './relectura-diferencias';

const fila = (
  producto: string,
  cantidad: number,
  almacen = 'COME Comedor',
  pedido = '133010',
): OrigenCorreoRenglon => ({
  'Numero pedido': pedido,
  Almacen: almacen,
  Producto: producto,
  Cantidad: cantidad,
});

describe('calcularDiferencias (POL-414)', () => {
  it('sin diferencias devuelve una lista vacía', () => {
    const filas = [fila('FRESA FRESCA', 3), fila('FRAMBUESA', 5)];

    expect(calcularDiferencias(filas, [...filas])).toEqual([]);
  });

  it('un nombre alterado con la misma cantidad es UN cambio, no un quitar y un agregar', () => {
    const antes = [fila('FRXXA FRESCA', 3), fila('FRAMBUESA', 5)];
    const despues = [fila('FRESA FRESCA', 3), fila('FRAMBUESA', 5)];

    const [unica, ...resto] = calcularDiferencias(antes, despues);

    expect(resto).toHaveLength(0);
    expect(unica!.publica).toMatchObject({
      id: 1,
      tipo: 'cambiar',
      almacen: 'COME Comedor',
      actual: { producto: 'FRXXA FRESCA', cantidad: '3' },
      leido: { producto: 'FRESA FRESCA', cantidad: '3' },
    });
  });

  it('un renglón repetido en la orden sale como quitar con repetidoEnActual', () => {
    const antes = [fila('ZARZAMORA', 2), fila('FRAMBUESA', 5), fila('ZARZAMORA', 2)];
    const despues = [fila('ZARZAMORA', 2), fila('FRAMBUESA', 5)];

    const diferencias = calcularDiferencias(antes, despues);

    expect(diferencias).toHaveLength(1);
    expect(diferencias[0]!.publica).toMatchObject({
      tipo: 'quitar',
      repetidoEnActual: true,
    });
    expect(diferencias[0]!.filaActual).toBe(antes[2]);
  });

  it('un producto que la lectura no trae se quita sin marca de repetido, y uno nuevo se agrega', () => {
    const antes = [fila('AGUACATE', 4), fila('PRODUCTO DE MAS', 9)];
    const despues = [fila('AGUACATE', 4), fila('PEPINO', 7)];

    const diferencias = calcularDiferencias(antes, despues);

    expect(diferencias.map((d) => d.publica.tipo)).toEqual(['quitar', 'agregar']);
    expect(diferencias[0]!.publica.repetidoEnActual).toBeUndefined();
    expect(diferencias.map((d) => d.publica.id)).toEqual([1, 2]);
  });

  it('un nombre alterado que el documento rotula con otro almacén es un cambio, y aplicarlo no mueve el almacén', () => {
    const antes = [fila('FRXXBUESA', 4, 'BCS Baja California')];
    const despues = [fila('FRAMBUESA', 4, 'PDF Playa del Carmen')];

    const diferencias = calcularDiferencias(antes, despues);

    expect(diferencias).toHaveLength(1);
    expect(diferencias[0]!.publica).toMatchObject({
      tipo: 'cambiar',
      almacen: 'BCS Baja California',
      almacenLeido: 'PDF Playa del Carmen',
    });
    const [aplicada] = aplicarDiferencias(antes, diferencias, new Set([1]));
    expect(aplicada).toMatchObject({
      Producto: 'FRAMBUESA',
      Almacen: 'BCS Baja California',
    });
  });

  it('con otro almacén no se empareja un nombre poco parecido ni otra cantidad', () => {
    const antes = [fila('AGUACATE', 4, 'BCS Baja California')];

    expect(
      calcularDiferencias(antes, [fila('PEPINO', 4, 'PDF Playa')]).map((d) => d.publica.tipo),
    ).toEqual(['quitar', 'agregar']);
    expect(
      calcularDiferencias(antes, [fila('AGUACATE', 9, 'PDF Playa')]).map((d) => d.publica.tipo),
    ).toEqual(['quitar', 'agregar']);
  });

  it('no empareja nombres sin parecido ni cantidades o almacenes distintos', () => {
    const antes = [fila('AGUACATE', 4)];
    const despues = [fila('ZZZZ', 4), fila('AGUACATE', 5), fila('AGUACATE', 4, 'BAR Bar')];

    const tipos = calcularDiferencias(antes, despues).map((d) => d.publica.tipo);

    expect(tipos).not.toContain('cambiar');
  });
});

describe('motivoDeDiferencia (POL-414)', () => {
  const [cambio] = calcularDiferencias(
    [fila('FRXXA FRESCA', 3)],
    [fila('FRESA FRESCA', 3)],
  );

  it('muestra la OT por su almacén y su pedido, sin ids ni claves internas', () => {
    const motivo = motivoDeDiferencia(cambio!.publica, true, 'Nombre correcto.');

    expect(motivo).toEqual({
      tipo: 'cambiar',
      ot: 'Almacén COME Comedor · pedido 133010',
      producto: 'FRXXA FRESCA → FRESA FRESCA',
      aplicada: true,
      motivo: 'Nombre correcto.',
    });
    expect(JSON.stringify(motivo)).not.toContain('|');
  });

  it('sin motivo del modelo usa una frase por omisión', () => {
    expect(motivoDeDiferencia(cambio!.publica, false, '  ').motivo).toBe(
      'Según lo que pediste.',
    );
  });
});

describe('aplicarDiferencias (POL-414)', () => {
  const antes = [fila('FRXXA FRESCA', 3), fila('ZARZAMORA', 2), fila('ZARZAMORA', 2), fila('SOBRA', 1)];
  const despues = [fila('FRESA FRESCA', 3), fila('ZARZAMORA', 2), fila('PEPINO', 7)];
  const diferencias = calcularDiferencias(antes, despues);
  const id = (tipo: string) =>
    diferencias.find((d) => d.publica.tipo === tipo)!.publica.id;

  it('sin ninguna aplicada, la orden queda exactamente como está', () => {
    expect(aplicarDiferencias(antes, diferencias, new Set())).toEqual(antes);
  });

  it('aplica solo las elegidas: el cambio de nombre y nada más', () => {
    const resultado = aplicarDiferencias(antes, diferencias, new Set([id('cambiar')]));

    expect(resultado.map((f) => f.Producto)).toEqual([
      'FRESA FRESCA',
      'ZARZAMORA',
      'ZARZAMORA',
      'SOBRA',
    ]);
  });

  it('aplicar todas deja las filas leídas', () => {
    const todas = new Set(diferencias.map((d) => d.publica.id));

    const resultado = aplicarDiferencias(antes, diferencias, todas);

    expect(resultado.map((f) => f.Producto).sort()).toEqual(
      despues.map((f) => f.Producto).sort(),
    );
  });

  it('no modifica los arreglos de entrada', () => {
    const copia = [...antes];
    aplicarDiferencias(antes, diferencias, new Set(diferencias.map((d) => d.publica.id)));

    expect(antes).toEqual(copia);
  });
});
