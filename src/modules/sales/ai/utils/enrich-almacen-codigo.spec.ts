import {
  enrichAlmacenConCodigoDesdeTexto,
  enrichLineasAlmacenConCodigoDesdeTexto,
} from './enrich-almacen-codigo';

describe('enrichAlmacenConCodigoDesdeTexto', () => {
  const pdf = `
Almacén
ABAN Banquetes Ali
ACOE ComedorEmplea
BAWH Bar Whisky
`;

  it('antepone ABAN si Mateo omitió el código', () => {
    expect(enrichAlmacenConCodigoDesdeTexto('Banquetes Ali', pdf)).toBe(
      'ABAN Banquetes Ali',
    );
  });

  it('antepone ACOE para comedor empleados', () => {
    expect(enrichAlmacenConCodigoDesdeTexto('ComedorEmplea', pdf)).toBe(
      'ACOE ComedorEmplea',
    );
  });

  it('no duplica si ya trae código', () => {
    expect(enrichAlmacenConCodigoDesdeTexto('ABAN Banquetes Ali', pdf)).toBe(
      'ABAN Banquetes Ali',
    );
  });

  it('no inventa código si no está en el texto', () => {
    expect(
      enrichAlmacenConCodigoDesdeTexto('Cocina central', 'sin códigos'),
    ).toBe('Cocina central');
  });

  it('enriquece líneas en lote', () => {
    const out = enrichLineasAlmacenConCodigoDesdeTexto(
      [
        { almacen: 'Banquetes Ali', x: 1 },
        { almacen: 'BAWH Bar Whisky', x: 2 },
      ],
      pdf,
    );
    expect(out[0]?.almacen).toBe('ABAN Banquetes Ali');
    expect(out[1]?.almacen).toBe('BAWH Bar Whisky');
  });
});
