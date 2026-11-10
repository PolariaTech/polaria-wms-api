import { alcanceSoloArchivo } from './relectura-alcance-archivo';

const DOCUMENTOS = [
  { nombre: 'OC 133010 COMEDOR.pdf', oc: '133010' },
  { nombre: 'OC 133011 BANQUETES.pdf', oc: '133011' },
  { nombre: 'OC 133013 AQUAMARINA.pdf', oc: '133013' },
];

describe('alcanceSoloArchivo (POL-414)', () => {
  it.each(['Solo COMEDOR', 'solo el archivo comedor.', 'Únicamente COMEDOR', 'Solo toma en cuenta el PDF COMEDOR'])(
    'toma el archivo y su OC: %s',
    (instruccion) => {
      const alcance = alcanceSoloArchivo(instruccion, DOCUMENTOS);

      expect(alcance?.nombres).toEqual(['OC 133010 COMEDOR.pdf']);
      expect([...alcance!.ocs]).toEqual(['133010']);
      expect(alcance!.descripcion).toContain('OC 133010 COMEDOR.pdf');
    },
  );

  it('acepta varios archivos en la misma frase', () => {
    const alcance = alcanceSoloArchivo('Solo COMEDOR y BANQUETES', DOCUMENTOS);

    expect([...alcance!.ocs].sort()).toEqual(['133010', '133011']);
  });

  it.each([
    'Solo corrige los nombres de los productos',
    'Solo corrige los nombres de COMEDOR',
    'Solo el almacén BAR',
    'Quita los repetidos',
    'Solo COMEDOR y el almacén BAR',
    'Solo OC',
    'Solo co',
    '',
  ])('no es «solo un archivo», lo decide la IA: %p', (instruccion) => {
    expect(alcanceSoloArchivo(instruccion, DOCUMENTOS)).toBeNull();
  });

  it('no limita si coincide con todos los archivos, con uno solo leído o sin OC', () => {
    expect(alcanceSoloArchivo('Solo OC 13301', DOCUMENTOS)).toBeNull();
    expect(alcanceSoloArchivo('Solo COMEDOR', [DOCUMENTOS[0]!])).toBeNull();
    expect(
      alcanceSoloArchivo('Solo COMEDOR', [{ nombre: 'COMEDOR.pdf', oc: null }, DOCUMENTOS[1]!]),
    ).toBeNull();
  });
});
