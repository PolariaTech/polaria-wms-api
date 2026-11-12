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

  it('REQ-309: textoOriginal es la descripción completa, no el nombre corto de la columna de código', () => {
    const regla = REGLAS_LECTURA_PEDIDO.find((linea) =>
      linea.startsWith('- Código y descripción (REQ-309)'),
    );
    expect(regla).toBeDefined();
    expect(regla).toMatch(/"textoOriginal" es la descripción COMPLETA del renglón/);
    expect(regla).toMatch(/nunca solo el nombre corto de la columna de código/);
    expect(regla).toMatch(/va en "codigoProductoCliente"/);
  });

  it('REQ-287: lo que no es nombre del producto va completo en especificacion', () => {
    const regla = REGLAS_LECTURA_PEDIDO.find((linea) =>
      linea.startsWith('- Especificación completa (REQ-287)'),
    );
    expect(regla).toBeDefined();
    for (const palabra of ['sin penacho', 'limpio', 'sin cáscara', 'en bote', 'fresco']) {
      expect(regla).toContain(palabra);
    }
    expect(regla).toMatch(/aunque ya esté dentro de "textoOriginal"/);
  });

  it('REQ-299: codigoProductoCliente es solo el código escrito en ese renglón', () => {
    const regla = REGLAS_LECTURA_PEDIDO.find((linea) =>
      linea.startsWith('- Código del cliente (REQ-299)'),
    );
    expect(regla).toBeDefined();
    expect(regla).toMatch(
      /"codigoProductoCliente" es SOLO el código escrito en ESE renglón/,
    );
    expect(regla).toMatch(
      /Nunca copies ahí un SKU del catálogo ni los SKU de las reglas/,
    );
    expect(regla).toMatch(/Si el renglón no trae código → null/);
  });
});
