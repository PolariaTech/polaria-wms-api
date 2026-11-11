import { REGLAS_LECTURA_PEDIDO } from './reglas-lectura-pedido';

describe('REGLAS_LECTURA_PEDIDO (REQ-288 / REQ-290)', () => {
  const texto = REGLAS_LECTURA_PEDIDO.join('\n');

  it('mantiene la regla de familia de producto (REQ-115)', () => {
    expect(texto).toContain('REQ-115');
  });

  it('pide extraer una sola vez lo que el mensaje y el archivo repiten', () => {
    expect(texto).toMatch(/UNA sola vez/);
    expect(texto).toMatch(/Recorre TODOS los renglones/);
  });

  it('separa el pimiento rojo de la pulpa de frutos rojos', () => {
    expect(texto).toMatch(/Pimiento morrón rojo.*NO es.*Pulpa de frutos rojos/);
  });

  it('conserva la unidad y las especificaciones del documento', () => {
    expect(texto).toContain('sin pecacho');
    expect(texto).toContain('conserva la unidad que dice el documento');
  });

  it('cada regla es una sola línea (sin saltos que parten el prompt)', () => {
    for (const regla of REGLAS_LECTURA_PEDIDO) {
      expect(regla).not.toContain('\n');
      expect(regla.startsWith('- ')).toBe(true);
    }
  });

  it('REQ-299: codigoProductoCliente es solo el código del renglón, no un SKU del catálogo', () => {
    expect(texto).toContain('codigoProductoCliente');
    expect(texto).toContain('REQ-299');
  });
});
