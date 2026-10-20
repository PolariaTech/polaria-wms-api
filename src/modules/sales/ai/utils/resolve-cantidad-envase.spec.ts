import {
  familiaUnidadCatalogo,
  parseEnvaseContenidoDesdeTexto,
  resolveCantidadPrecioDesdeEnvase,
} from './resolve-cantidad-envase';

describe('familiaUnidadCatalogo', () => {
  it('normaliza LTR/KGM/PZA', () => {
    expect(familiaUnidadCatalogo('LTR')).toBe('ltr');
    expect(familiaUnidadCatalogo('KGM')).toBe('kg');
    expect(familiaUnidadCatalogo('PZA')).toBe('pza');
    expect(familiaUnidadCatalogo('kg')).toBe('kg');
  });
});

describe('parseEnvaseContenidoDesdeTexto', () => {
  it('lee 1 galón de 5 litros', () => {
    expect(
      parseEnvaseContenidoDesdeTexto('Jugo de Limón fresco galón de 5 litros'),
    ).toMatchObject({
      envases: 1,
      contenidoPorEnvase: 5,
      familiaContenido: 'ltr',
    });
  });

  it('lee cubeta de 10 litros', () => {
    expect(
      parseEnvaseContenidoDesdeTexto(
        'Jugo de naranja fresco cubeta de 10 litros',
      ),
    ).toMatchObject({
      envases: 1,
      contenidoPorEnvase: 10,
      familiaContenido: 'ltr',
    });
  });

  it('lee N cajas de X kg', () => {
    expect(parseEnvaseContenidoDesdeTexto('15 cajas de 20 kg')).toMatchObject({
      envases: 15,
      contenidoPorEnvase: 20,
      familiaContenido: 'kg',
    });
  });
});

describe('resolveCantidadPrecioDesdeEnvase', () => {
  it('1 galón de 5 L + LTR + precio 350 → 5 LTR @ 70', () => {
    expect(
      resolveCantidadPrecioDesdeEnvase({
        textoOriginal: 'Jugo de Limón fresco galón de 5 litros',
        unidadMedidaCatalogo: 'LTR',
        cantidadRaw: 1,
        precioDoc: 350,
      }),
    ).toMatchObject({
      cantidad: 5,
      precioUnitario: 70,
      envases: 1,
      contenidoPorEnvase: 5,
    });
  });

  it('2 cubetas de 10 L (cantidad 2) + LTR + 720 → 20 @ 72', () => {
    expect(
      resolveCantidadPrecioDesdeEnvase({
        textoOriginal: 'Jugo de naranja fresco cubeta de 10 litros',
        unidadMedidaCatalogo: 'LTR',
        cantidadRaw: 2,
        precioDoc: 720,
      }),
    ).toMatchObject({
      cantidad: 20,
      precioUnitario: 72,
      envases: 2,
      contenidoPorEnvase: 10,
    });
  });

  it('no toca si ya está convertido (5 LTR @ 70)', () => {
    expect(
      resolveCantidadPrecioDesdeEnvase({
        textoOriginal: 'galón de 5 litros',
        unidadMedidaCatalogo: 'LTR',
        cantidadRaw: 5,
        precioDoc: 70,
      }),
    ).toBeNull();
  });

  it('no convierte si el catálogo es PZA', () => {
    expect(
      resolveCantidadPrecioDesdeEnvase({
        textoOriginal: '1 galón de 5 litros',
        unidadMedidaCatalogo: 'PZA',
        cantidadRaw: 1,
        precioDoc: 350,
      }),
    ).toBeNull();
  });

  it('cajas de kg → KGM', () => {
    expect(
      resolveCantidadPrecioDesdeEnvase({
        textoOriginal: 'pedido de 3 cajas de 20 kg aguacate',
        unidadMedidaCatalogo: 'KGM',
        cantidadRaw: 3,
        precioDoc: 600,
      }),
    ).toMatchObject({
      cantidad: 60,
      precioUnitario: 30,
    });
  });
});
