import { ConflictException } from '@nestjs/common';
import { EmpresaService } from './empresa.service';
import { EmpresaRepository } from '../infrastructure/empresa.repository';

describe('EmpresaService.create', () => {
  const repository = {
    findByCodigo: jest.fn(),
    create: jest.fn(),
  };

  const service = new EmpresaService(
    repository as unknown as EmpresaRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provisiona empresa nueva con schemaName', async () => {
    repository.findByCodigo.mockResolvedValue(null);
    repository.create.mockResolvedValue({
      codigoEmpresa: 'ANDINO',
      razonSocial: 'Andino SpA',
      telefono: null,
      estaActiva: true,
      schemaName: 'emp_andino',
    });

    const result = await service.create({
      codigoEmpresa: 'ANDINO',
      razonSocial: 'Andino SpA',
    });

    expect(repository.create).toHaveBeenCalledWith({
      codigoEmpresa: 'ANDINO',
      razonSocial: 'Andino SpA',
      telefono: null,
      idCreador: null,
    });
    expect(result.schemaName).toBe('emp_andino');
  });

  it('rechaza código duplicado', async () => {
    repository.findByCodigo.mockResolvedValue({
      codigoEmpresa: 'ANDINO',
      razonSocial: 'Existente',
      telefono: null,
      estaActiva: true,
    });

    await expect(
      service.create({
        codigoEmpresa: 'ANDINO',
        razonSocial: 'Otra',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
