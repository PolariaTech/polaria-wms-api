import { UpdateEmpresaResponseDto } from './update-empresa-response.dto';

describe('UpdateEmpresaResponseDto', () => {
  it('expone la ficha fiscal y el logo', () => {
    const respuesta = new UpdateEmpresaResponseDto();
    respuesta.codigoEmpresa = 'Y9IHZ';
    respuesta.clabe = '012528001186364430';
    respuesta.logoPath = null;

    expect(respuesta.clabe).toHaveLength(18);
    expect(respuesta.logoPath).toBeNull();
  });
});
