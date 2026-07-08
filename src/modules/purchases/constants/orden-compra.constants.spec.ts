import {
  formatCodigoOrden,
  parseCodigoOrdenSecuencia,
} from './orden-compra.constants';

describe('orden-compra.constants', () => {
  describe('formatCodigoOrden', () => {
    it('formatea la secuencia con prefijo OC-', () => {
      expect(formatCodigoOrden(4n)).toBe('OC-000004');
    });
  });

  describe('parseCodigoOrdenSecuencia', () => {
    it('extrae la secuencia de un código válido', () => {
      expect(parseCodigoOrdenSecuencia('OC-000003')).toBe(3n);
    });

    it('retorna null para códigos con prefijo distinto', () => {
      expect(parseCodigoOrdenSecuencia('SOL-000003')).toBeNull();
    });

    it('retorna null para sufijos no numéricos', () => {
      expect(parseCodigoOrdenSecuencia('OC-ABC123')).toBeNull();
    });
  });
});
