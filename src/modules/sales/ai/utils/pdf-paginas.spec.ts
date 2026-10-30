import { construirBloques, encabezadoDeDocumento } from './pdf-paginas';

const ENCABEZADO = [
  'Facturar a:',
  'Solaya Hospitality Management Group',
  'No. Pedido 4502986931',
  'Fecha de entrega: 30.10.2026',
  'ID Artículo Artículo Almacén Cantidad UM Precio',
].join('\n');

function pagina(numero: number, filas: number, conEncabezado = false): string {
  const cuerpo = Array.from(
    { length: filas },
    (_, i) => `100${numero}${i} PRODUCTO ${numero}-${i} ACOE ComedorEmplea 1 KG 10.00 MXN 10.00`,
  ).join('\n');
  return conEncabezado ? `${ENCABEZADO}\n${cuerpo}` : cuerpo;
}

describe('pdf-paginas', () => {
  describe('encabezadoDeDocumento', () => {
    it('toma la primera página hasta la fila de títulos de la tabla', () => {
      const encabezado = encabezadoDeDocumento([pagina(1, 5, true)]);
      expect(encabezado).toContain('No. Pedido 4502986931');
      expect(encabezado.split('\n').pop()).toContain('ID Artículo');
      expect(encabezado).not.toContain('PRODUCTO 1-0');
    });

    it('sin fila de títulos usa un tope de líneas', () => {
      const largo = Array.from({ length: 60 }, (_, i) => `linea ${i}`).join('\n');
      expect(encabezadoDeDocumento([largo]).split('\n')).toHaveLength(25);
    });
  });

  describe('construirBloques', () => {
    it('un documento chico queda en un solo bloque', () => {
      const bloques = construirBloques([pagina(1, 3, true), pagina(2, 3)], 10_000);
      expect(bloques).toHaveLength(1);
      expect(bloques[0]).toContain('PRODUCTO 2-2');
    });

    it('parte por páginas completas y repite el encabezado en los bloques siguientes', () => {
      const paginas = [pagina(1, 10, true), pagina(2, 10), pagina(3, 10), pagina(4, 10)];
      const tope = pagina(1, 10, true).length + 50;
      const bloques = construirBloques(paginas, tope);

      expect(bloques.length).toBeGreaterThan(1);
      // No se pierde ninguna fila.
      const todas = bloques.join('\n');
      for (let p = 1; p <= 4; p += 1) {
        for (let i = 0; i < 10; i += 1) {
          expect(todas).toContain(`PRODUCTO ${p}-${i} `);
        }
      }
      // El primero ya trae el encabezado en su página; los demás lo reciben.
      for (const bloque of bloques.slice(1)) {
        expect(bloque.startsWith('Facturar a:')).toBe(true);
        expect(bloque).toContain('No. Pedido 4502986931');
      }
    });

    it('una página mayor que el tope va sola, sin cortarse a media fila', () => {
      const grande = pagina(1, 100, true);
      const bloques = construirBloques([grande, pagina(2, 2)], 500);
      expect(bloques[0]).toBe(grande);
    });

    it('ignora páginas vacías (PDF escaneado) y devuelve [] si no hay texto', () => {
      expect(construirBloques(['', '   '])).toEqual([]);
      expect(construirBloques([pagina(1, 2, true), ''])).toHaveLength(1);
    });
  });
});
