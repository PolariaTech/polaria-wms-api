import type { AdvertenciaLectura } from './pedido-ia.service';
import { documentosIgnorados, filtrarArchivosIgnorados } from './relectura-archivos';

const archivo = (originalname: string) => ({ originalname, buffer: Buffer.from('x') });

describe('filtrarArchivosIgnorados (POL-414)', () => {
  const archivos = [archivo('OC 133010 COMEDOR.pdf'), archivo('OC 133013 AQUAMARINA.pdf')];

  it('quita el archivo que la instrucción ignora y deja un aviso por él', () => {
    const advertencias: AdvertenciaLectura[] = [];

    const r = filtrarArchivosIgnorados('Ignora el archivo AQUAMARINA', archivos, advertencias);

    expect(r.aLeer.map((a) => a.originalname)).toEqual(['OC 133010 COMEDOR.pdf']);
    expect(r.ignorados).toEqual(['OC 133013 AQUAMARINA.pdf']);
    expect(advertencias).toEqual([
      expect.objectContaining({ codigo: 'ARCHIVO_IGNORADO', documento: 'OC 133013 AQUAMARINA.pdf' }),
    ]);
  });

  it('sin instrucción que ignore archivos, lee todos y no avisa', () => {
    const advertencias: AdvertenciaLectura[] = [];

    const r = filtrarArchivosIgnorados('Solo corrige los nombres', archivos, advertencias);

    expect(r.aLeer).toHaveLength(2);
    expect(r.ignorados).toEqual([]);
    expect(advertencias).toEqual([]);
  });
});

describe('documentosIgnorados (POL-414)', () => {
  it('lista cada archivo ignorado con 0 productos', () => {
    const [documento] = documentosIgnorados(['OC 133013 AQUAMARINA.pdf']);

    expect(documento).toMatchObject({
      nombre: 'OC 133013 AQUAMARINA.pdf',
      renglones: 0,
      oc: null,
      verificacion: { importe: 0, cuadra: null },
    });
  });

  it('sin archivos ignorados no agrega nada', () => {
    expect(documentosIgnorados([])).toEqual([]);
  });
});
