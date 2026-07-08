import {
  formatSlotCodigo,
  formatZoneSlotCodigo,
  resolveCapacidadSlots,
} from './warehouse-layout.constants';

describe('warehouse-layout.constants', () => {
  describe('resolveCapacidadSlots', () => {
    it('default a 1 cuando es null o undefined', () => {
      expect(resolveCapacidadSlots(null)).toBe(1);
      expect(resolveCapacidadSlots(undefined)).toBe(1);
    });

    it('aplica mínimo 1', () => {
      expect(resolveCapacidadSlots(0)).toBe(1);
      expect(resolveCapacidadSlots(-10)).toBe(1);
    });

    it('aplica máximo 500', () => {
      expect(resolveCapacidadSlots(501)).toBe(500);
      expect(resolveCapacidadSlots(9999)).toBe(500);
    });
  });

  describe('formatSlotCodigo', () => {
    it('formatea SLOT-001 con padding mínimo de 3', () => {
      expect(formatSlotCodigo(1, 10)).toBe('SLOT-001');
      expect(formatSlotCodigo(10, 10)).toBe('SLOT-010');
    });

    it('amplía padding cuando hay más de 999 slots', () => {
      expect(formatSlotCodigo(1000, 1000)).toBe('SLOT-1000');
    });
  });

  describe('formatZoneSlotCodigo', () => {
    it('formatea ING-01 con padding mínimo de 2', () => {
      expect(formatZoneSlotCodigo('ING-', 1, 8)).toBe('ING-01');
      expect(formatZoneSlotCodigo('SAL-', 8, 8)).toBe('SAL-08');
    });
  });
});
