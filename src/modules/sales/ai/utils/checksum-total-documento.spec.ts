import {
  extraerTotalDocumento,
  parseMonto,
  sumarImportes,
  verificarTotalDocumento,
} from './checksum-total-documento';

describe('checksum-total-documento', () => {
  describe('parseMonto', () => {
    it.each([
      ['27,905.25', 27905.25],
      ['27.905,25', 27905.25],
      ['1,234', 1234],
      ['11,500.60', 11500.6],
      ['18163.75', 18163.75],
      ['12,5', 12.5],
    ])('%s → %s', (raw, esperado) => {
      expect(parseMonto(raw)).toBe(esperado);
    });

    it('devuelve null si no hay dígitos', () => {
      expect(parseMonto('abc')).toBeNull();
    });
  });

  describe('extraerTotalDocumento', () => {
    it('lee el total del pedido con moneda', () => {
      expect(extraerTotalDocumento('...\nTotal pedido: MXN 27,905.25')).toBe(
        27905.25,
      );
    });

    it('toma el último total cuando el texto trae varios', () => {
      const texto = 'Total pedido: MXN 100.00\n...\nTotal pedido: MXN 250.50';
      expect(extraerTotalDocumento(texto)).toBe(250.5);
    });

    it('devuelve null si el documento no declara total', () => {
      expect(extraerTotalDocumento('Pedido sin total declarado')).toBeNull();
    });
  });

  describe('sumarImportes', () => {
    it('suma cantidad × precio y tolera textos con coma decimal y vacíos', () => {
      expect(
        sumarImportes([
          { Cantidad: 2, Precio: 10.5 },
          { Cantidad: '1,5', Precio: '4' },
          { Cantidad: 3, Precio: '' },
        ]),
      ).toBe(27);
    });
  });

  describe('verificarTotalDocumento', () => {
    const texto = 'Total pedido: MXN 100.00';

    it('cuadra cuando la suma iguala el total', () => {
      const r = verificarTotalDocumento(texto, [
        { Cantidad: 4, Precio: 25 },
      ]);
      expect(r).toEqual({
        totalDocumento: 100,
        importe: 100,
        diferencia: 0,
        cuadra: true,
      });
    });

    it('no cuadra cuando faltan renglones (caso OV-940: 22,261.35 de 27,905.25)', () => {
      const r = verificarTotalDocumento('Total pedido: MXN 27,905.25', [
        { Cantidad: 1, Precio: 22261.35 },
      ]);
      expect(r.cuadra).toBe(false);
      expect(r.diferencia).toBe(-5643.9);
    });

    it('tolera centavos de redondeo', () => {
      const r = verificarTotalDocumento(texto, [{ Cantidad: 1, Precio: 100.04 }]);
      expect(r.cuadra).toBe(true);
    });

    it('cuadra = null si el documento no trae total (no verificable)', () => {
      const r = verificarTotalDocumento('sin total', [
        { Cantidad: 1, Precio: 5 },
      ]);
      expect(r.cuadra).toBeNull();
      expect(r.totalDocumento).toBeNull();
      expect(r.importe).toBe(5);
    });
  });
});
