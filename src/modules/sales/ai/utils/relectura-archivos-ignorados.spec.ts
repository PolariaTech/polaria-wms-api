import { archivosAIgnorar } from './relectura-archivos-ignorados';

const NOMBRES = [
  'OC 133010 COMEDOR.pdf',
  'OC 133011 BANQUETES.pdf',
  'OC 133012 BAR PLAYA.pdf',
  'OC 133013 AQUAMARINA.pdf',
  'OC 133014 CAFETERIA.pdf',
];

describe('archivosAIgnorar (POL-414)', () => {
  it('ignora el archivo que la instrucción nombra completo (CA4)', () => {
    expect(
      archivosAIgnorar('Ignora el archivo OC 133013 AQUAMARINA.pdf', NOMBRES),
    ).toEqual(['OC 133013 AQUAMARINA.pdf']);
  });

  it('acepta el nombre parcial, sin extensión y con mayúsculas o tildes distintas', () => {
    expect(archivosAIgnorar('omite el PDF aquamarina', NOMBRES)).toEqual([
      'OC 133013 AQUAMARINA.pdf',
    ]);
    expect(archivosAIgnorar('No leas el archivo cafetería', NOMBRES)).toEqual([
      'OC 133014 CAFETERIA.pdf',
    ]);
  });

  it('ignora varios archivos nombrados en la misma frase', () => {
    expect(
      archivosAIgnorar('Ignora los archivos COMEDOR y BANQUETES', NOMBRES).sort(),
    ).toEqual(['OC 133010 COMEDOR.pdf', 'OC 133011 BANQUETES.pdf']);
  });

  it('el punto de la extensión no corta la frase, pero un punto y aparte sí', () => {
    expect(
      archivosAIgnorar(
        'Ignora el archivo OC 133013 AQUAMARINA.pdf. Corrige los nombres de BANQUETES.',
        NOMBRES,
      ),
    ).toEqual(['OC 133013 AQUAMARINA.pdf']);
  });

  it.each([
    'Vuelve a leer el correo y los archivos y corrige lo que no coincida.',
    'Ignora el almacén COMEDOR',
    'Solo corrige los nombres de los productos; no quites ni agregues productos',
    '',
  ])('no ignora nada si la instrucción no pide ignorar un archivo: %p', (texto) => {
    expect(archivosAIgnorar(texto, NOMBRES)).toEqual([]);
  });

  it('sin instrucción o con un solo archivo no ignora nada', () => {
    expect(archivosAIgnorar(undefined, NOMBRES)).toEqual([]);
    expect(archivosAIgnorar('Ignora el archivo COMEDOR', [NOMBRES[0]!])).toEqual(
      [],
    );
  });

  it('si la instrucción coincide con todos los archivos, no ignora ninguno', () => {
    expect(
      archivosAIgnorar('Ignora todos los archivos OC', NOMBRES),
    ).toEqual([]);
  });

  it('un fragmento demasiado corto no coincide con casi cualquier nombre', () => {
    expect(archivosAIgnorar('Ignora el archivo de', NOMBRES)).toEqual([]);
  });
});
