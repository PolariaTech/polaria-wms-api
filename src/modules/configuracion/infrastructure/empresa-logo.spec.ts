import {
  LOGO_EMPRESA_MAX_BYTES,
  validarLogoEmpresa,
} from './empresa-logo';

describe('validarLogoEmpresa', () => {
  it.each(['image/jpeg', 'image/png'])('acepta un %s de 1 MB', (mimetype) => {
    expect(
      validarLogoEmpresa({
        size: LOGO_EMPRESA_MAX_BYTES,
        mimetype,
      }),
    ).toBeNull();
  });

  it('rechaza un archivo de 1048577 bytes', () => {
    expect(
      validarLogoEmpresa({
        size: LOGO_EMPRESA_MAX_BYTES + 1,
        mimetype: 'image/jpeg',
      }),
    ).toBe('El logo supera 1 MB.');
  });

  it('rechaza un MIME que no es JPEG ni PNG', () => {
    expect(
      validarLogoEmpresa({ size: 100, mimetype: 'image/gif' }),
    ).toBe('El logo debe ser JPEG o PNG.');
  });
});
