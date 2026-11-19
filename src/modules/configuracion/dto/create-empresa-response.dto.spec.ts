import { CreateEmpresaResponseDto } from './create-empresa-response.dto';

describe('CreateEmpresaResponseDto', () => {
  it('expone la ficha fiscal y el logo', () => {
    const respuesta = new CreateEmpresaResponseDto();
    respuesta.codigoEmpresa = 'Y9IHZ';
    respuesta.rfc = 'APU210325668';
    respuesta.logoPath = 'Y9IHZ/logo.jpg';

    expect(respuesta.rfc).toBe('APU210325668');
    expect(respuesta.logoPath).toBe('Y9IHZ/logo.jpg');
  });
});
