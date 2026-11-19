import { fichaFiscalPresente } from './empresa-ficha-fiscal';

describe('fichaFiscalPresente', () => {
  it('copia solo los campos que vinieron y convierte vacío en null', () => {
    expect(
      fichaFiscalPresente({
        rfc: 'APU210325668',
        clabe: null,
      }),
    ).toEqual({
      rfc: 'APU210325668',
      clabe: null,
    });
  });

  it('no inventa campos ausentes', () => {
    expect(fichaFiscalPresente({})).toEqual({});
  });
});
