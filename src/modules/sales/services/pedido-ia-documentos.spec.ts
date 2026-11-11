import {
  excluirDocumentosIgnorados,
  mapConLimite,
  nombreBaseAdjunto,
  separarContextoYDocumentos,
  type DocumentoParaLeer,
} from './pedido-ia-documentos';

const cuerpo = {
  nombre: 'correo.eml — cuerpo',
  tipo: 'texto' as const,
  contenido: 'Buen día, confirmo la orden de compra.',
};

describe('separarContextoYDocumentos', () => {
  it('descarta el adjunto incrustado en el .eml que también se subió suelto', () => {
    const r = separarContextoYDocumentos([
      cuerpo,
      { nombre: 'correo.eml → A.pdf', tipo: 'texto', contenido: 'a' },
      { nombre: 'correo.eml → B.pdf', tipo: 'texto', contenido: 'b' },
      { nombre: 'A.pdf', tipo: 'texto', contenido: 'a' },
    ]);
    expect(r.contexto).toHaveLength(1);
    expect(r.documentos.map((d) => d.nombre)).toEqual([
      'correo.eml → B.pdf',
      'A.pdf',
    ]);
    expect(r.duplicados).toEqual(['correo.eml → A.pdf']);
  });

  it('las imágenes van con el primer documento si hay textos, o solas si no', () => {
    const imagen = { nombre: 'foto.jpg', tipo: 'imagen' as const, mime: 'image/jpeg', base64: 'x' };
    const conTexto = separarContextoYDocumentos([
      { nombre: 'A.pdf', tipo: 'texto', contenido: 'a' },
      imagen,
    ]);
    expect(conTexto.documentos).toHaveLength(1);
    expect(conTexto.documentos[0]!.archivos).toHaveLength(2);

    const soloImagen = separarContextoYDocumentos([imagen]);
    expect(soloImagen.documentos).toHaveLength(1);
    expect(soloImagen.documentos[0]!.esTexto).toBe(false);
  });

  it('separa los no legibles', () => {
    const r = separarContextoYDocumentos([
      { nombre: 'x.bin', tipo: 'no_legible', motivo: 'formato no soportado' },
    ]);
    expect(r.noLegibles).toHaveLength(1);
    expect(r.documentos).toHaveLength(0);
  });

  it('nombreBaseAdjunto compara sin la parte del .eml ni mayúsculas', () => {
    expect(nombreBaseAdjunto('correo.eml → Pedido_1.PDF')).toBe('pedido_1.pdf');
  });
});

describe('mapConLimite', () => {
  it('respeta el límite de concurrencia y conserva el orden', async () => {
    let enVuelo = 0;
    let pico = 0;
    const r = await mapConLimite([1, 2, 3, 4, 5, 6], 2, async (n) => {
      enVuelo += 1;
      pico = Math.max(pico, enVuelo);
      await new Promise((ok) => setTimeout(ok, 5));
      enVuelo -= 1;
      return n * 10;
    });
    expect(r).toEqual([10, 20, 30, 40, 50, 60]);
    expect(pico).toBeLessThanOrEqual(2);
  });
});

describe('excluirDocumentosIgnorados (POL-414)', () => {
  const documento = (nombre: string): DocumentoParaLeer => ({
    nombre,
    archivos: [{ nombre, tipo: 'texto', contenido: 'x' }],
    esTexto: true,
  });
  const documentos = [
    documento('A.pdf'),
    documento('correo.eml → B.pdf'),
    documento('C.pdf'),
  ];

  it('sin nombres a ignorar devuelve los mismos documentos', () => {
    expect(excluirDocumentosIgnorados(documentos, undefined)).toBe(documentos);
    expect(excluirDocumentosIgnorados(documentos, [])).toBe(documentos);
  });

  it('quita el documento por nombre sin importar mayúsculas, también su copia incrustada en el .eml', () => {
    const resultado = excluirDocumentosIgnorados(documentos, ['a.PDF', 'b.pdf']);

    expect(resultado.map((d) => d.nombre)).toEqual(['C.pdf']);
  });
});
