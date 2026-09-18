import {
  isPhoneIdentificador,
  normalizePhoneIdentificador,
  parseProfileTelefono,
  phoneLookupVariants,
} from './phone.util';

describe('phone.util', () => {
  it('normaliza móvil CO de 10 dígitos a E.164', () => {
    expect(normalizePhoneIdentificador('3001112233')).toBe('+573001112233');
    expect(normalizePhoneIdentificador('+57 300 111 2233')).toBe(
      '+573001112233',
    );
  });

  it('rechaza correo y textos cortos', () => {
    expect(isPhoneIdentificador('admin@empresa.com')).toBe(false);
    expect(normalizePhoneIdentificador('123')).toBeNull();
  });

  it('arma variantes de búsqueda', () => {
    const variants = phoneLookupVariants('+573001112233');
    expect(variants).toEqual(
      expect.arrayContaining(['+573001112233', '573001112233', '3001112233']),
    );
  });

  it('parsea teléfono de perfil a E.164 o vacío', () => {
    expect(parseProfileTelefono('')).toEqual({ kind: 'empty' });
    expect(parseProfileTelefono(null)).toEqual({ kind: 'empty' });
    expect(parseProfileTelefono('3001112233')).toEqual({
      kind: 'ok',
      value: '+573001112233',
    });
    expect(parseProfileTelefono('abc')).toEqual({ kind: 'invalid' });
  });
});
