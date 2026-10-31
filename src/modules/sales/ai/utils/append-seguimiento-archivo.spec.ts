import {
  appendSeguimientoArchivo,
  nombreArchivoSeguimiento,
  parseOrigenArchivosLista,
} from './append-seguimiento-archivo';

describe('appendSeguimientoArchivo', () => {
  it('arma un nombre distinto de correo.eml', () => {
    expect(nombreArchivoSeguimiento('19c4a2')).toBe('seguimiento-19c4a2.eml');
    expect(nombreArchivoSeguimiento('msg/19 c4')).toBe('seguimiento-msg19c4.eml');
  });

  it('agrega el seguimiento sin borrar el correo original', () => {
    const existing = parseOrigenArchivosLista(
      JSON.stringify([
        { nombre: 'correo.eml', path: '023wa/8f3a-correo.eml' },
        { nombre: 'AGUACATES.pdf', path: '023wa/9c11-AGUACATES.pdf' },
      ]),
    );
    const result = appendSeguimientoArchivo(existing, {
      nombre: 'seguimiento-19c4a2.eml',
      path: '023wa/b772-seguimiento-19c4a2.eml',
    });
    expect(result.agregado).toBe(true);
    expect(result.items.map((item) => item.nombre)).toEqual([
      'correo.eml',
      'AGUACATES.pdf',
      'seguimiento-19c4a2.eml',
    ]);
  });

  it('no duplica el mismo seguimiento', () => {
    const existing = [
      { nombre: 'correo.eml', path: '023wa/8f3a-correo.eml' },
      { nombre: 'seguimiento-19c4a2.eml', path: '023wa/b772-seguimiento-19c4a2.eml' },
    ];
    const result = appendSeguimientoArchivo(existing, {
      nombre: 'seguimiento-19c4a2.eml',
      path: '023wa/otro-seguimiento-19c4a2.eml',
    });
    expect(result.agregado).toBe(false);
    expect(result.items).toHaveLength(2);
  });

  it('lee el formato legado de nombres sueltos', () => {
    expect(parseOrigenArchivosLista('correo.eml, pedido.pdf')).toEqual([
      { nombre: 'correo.eml' },
      { nombre: 'pedido.pdf' },
    ]);
  });
});
