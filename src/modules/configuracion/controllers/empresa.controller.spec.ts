import { EmpresaController } from './empresa.controller';
import { EmpresaService } from '../services/empresa.service';

describe('EmpresaController', () => {
  const service = {
    create: jest.fn(),
    update: jest.fn(),
  };
  const controller = new EmpresaController(service as unknown as EmpresaService);

  const logo = {
    buffer: Buffer.from('jpeg'),
    mimetype: 'image/jpeg',
    size: 4,
  } as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pasa la ficha y el logo al crear', () => {
    const dto = { codigoEmpresa: 'Y9IHZ', razonSocial: 'Aguacates de puebla' };
    void controller.create(dto, logo);
    expect(service.create).toHaveBeenCalledWith(dto, logo);
  });

  it('pasa la ficha al editar y conserva la llamada sin archivo', () => {
    const dto = { clabe: '012528001186364430' };
    void controller.update('Y9IHZ', dto);
    expect(service.update).toHaveBeenCalledWith('Y9IHZ', dto, undefined);
  });
});
