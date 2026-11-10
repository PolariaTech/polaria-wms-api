import type { ArchivoTexto } from '../file-extractors';
import { descartarDocumentosRepetidos } from './dedupe-documentos';

const SEP = ' → ';
const opciones = {
  separadorEml: SEP,
  nombreBase: (nombre: string) =>
    (nombre.includes(SEP)
      ? nombre.slice(nombre.lastIndexOf(SEP) + SEP.length)
      : nombre
    ).toLowerCase(),
};
const texto = (nombre: string, contenido: string): ArchivoTexto => ({
  nombre,
  tipo: 'texto',
  contenido,
});
const PEDIDO =
  'Cebolla morada 20 KG\nPimiento morrón rojo 20 KG\nTomate verde 10 KG';

describe('descartarDocumentosRepetidos (REQ-288)', () => {
  it('descarta el mismo texto con otro nombre y deja el suelto', () => {
    const resultado = descartarDocumentosRepetidos(
      [texto('correo.eml → copia.pdf', PEDIDO), texto('pedido.pdf', PEDIDO)],
      opciones,
    );
    expect(resultado.unicos.map((d) => d.nombre)).toEqual(['pedido.pdf']);
    expect(resultado.duplicados).toEqual(['correo.eml → copia.pdf']);
  });

  it('compara sin importar espacios, tildes ni mayúsculas', () => {
    const resultado = descartarDocumentosRepetidos(
      [
        texto('a.pdf', PEDIDO),
        texto('b.pdf', PEDIDO.toUpperCase().replace(/\n/g, '  \n ')),
      ],
      opciones,
    );
    expect(resultado.unicos.map((d) => d.nombre)).toEqual(['a.pdf']);
  });

  it('conserva documentos con texto distinto', () => {
    const resultado = descartarDocumentosRepetidos(
      [texto('a.pdf', PEDIDO), texto('b.pdf', `${PEDIDO}\nChile serrano 5 KG`)],
      opciones,
    );
    expect(resultado.unicos).toHaveLength(2);
    expect(resultado.duplicados).toEqual([]);
  });

  it('no trata como iguales dos textos demasiado cortos', () => {
    const resultado = descartarDocumentosRepetidos(
      [texto('a.pdf', 'a'), texto('b.pdf', 'a')],
      opciones,
    );
    expect(resultado.unicos).toHaveLength(2);
  });

  it('sigue descartando el incrustado cuyo suelto tiene el mismo nombre', () => {
    const resultado = descartarDocumentosRepetidos(
      [texto('c.eml → A.pdf', 'a'), texto('A.pdf', 'a')],
      opciones,
    );
    expect(resultado.duplicados).toEqual(['c.eml → A.pdf']);
  });
});
