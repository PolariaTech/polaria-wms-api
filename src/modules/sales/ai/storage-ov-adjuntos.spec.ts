import { parseOrigenArchivos, pathPerteneceACuenta } from './storage-ov-adjuntos';

describe('storage-ov-adjuntos', () => {
  describe('pathPerteneceACuenta', () => {
    it('acepta un path dentro de la carpeta de la cuenta', () => {
      expect(
        pathPerteneceACuenta('023wa/abc-correo.eml', '023WA'),
      ).toBe(true);
    });

    it('rechaza el path de otra cuenta (IDOR)', () => {
      expect(pathPerteneceACuenta('1yw43/abc-correo.eml', '023WA')).toBe(false);
    });

    it('rechaza escapes con ..', () => {
      expect(
        pathPerteneceACuenta('023wa/../1yw43/abc.pdf', '023WA'),
      ).toBe(false);
    });

    it('rechaza rutas absolutas, con barra invertida o segmentos vacíos', () => {
      expect(pathPerteneceACuenta('/023wa/abc.pdf', '023WA')).toBe(false);
      expect(pathPerteneceACuenta('023wa\\abc.pdf', '023WA')).toBe(false);
      expect(pathPerteneceACuenta('023wa//abc.pdf', '023WA')).toBe(false);
    });

    it('no se deja engañar por un prefijo parecido', () => {
      expect(pathPerteneceACuenta('023wa-otra/abc.pdf', '023WA')).toBe(false);
    });
  });

  describe('parseOrigenArchivos', () => {
    it('lee el JSON con path y nombre', () => {
      const json = JSON.stringify([
        { nombre: 'a.pdf', path: '023wa/x-a.pdf', mime: 'application/pdf', bytes: 10 },
      ]);
      expect(parseOrigenArchivos(json)).toHaveLength(1);
    });

    it('descarta elementos sin path y texto libre de OV viejas', () => {
      expect(parseOrigenArchivos('correo.eml, pedido.pdf')).toEqual([]);
      expect(parseOrigenArchivos(JSON.stringify([{ nombre: 'solo-nombre' }]))).toEqual([]);
      expect(parseOrigenArchivos(null)).toEqual([]);
    });
  });
});
