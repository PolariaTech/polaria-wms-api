import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EmpresaRepository } from '../infrastructure/empresa.repository';
import { EmpresaService } from './empresa.service';

describe('EmpresaService', () => {
  let service: EmpresaService;
  let repository: jest.Mocked<EmpresaRepository>;

  const empresa = {
    codigoEmpresa: 'EVU53',
    razonSocial: 'Tecno',
    telefono: null as string | null,
    estaActiva: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmpresaService,
        {
          provide: EmpresaRepository,
          useValue: {
            findByCodigo: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(EmpresaService);
    repository = module.get(EmpresaRepository);
    repository.findByCodigo.mockResolvedValue(empresa);
    repository.update.mockResolvedValue({
      ...empresa,
      razonSocial: 'Tecno SpA',
      estaActiva: false,
    });
  });

  it('actualiza razón social y estado', async () => {
    await expect(
      service.update('EVU53', {
        razonSocial: 'Tecno SpA',
        estaActiva: false,
      }),
    ).resolves.toEqual({
      codigoEmpresa: 'EVU53',
      razonSocial: 'Tecno SpA',
      telefono: null,
      estaActiva: false,
    });

    expect(repository.findByCodigo).toHaveBeenCalledWith('EVU53');
    expect(repository.update).toHaveBeenCalledWith('EVU53', {
      razonSocial: 'Tecno SpA',
      estaActiva: false,
    });
  });

  it('limpia teléfono vacío a null', async () => {
    repository.update.mockResolvedValue({
      ...empresa,
      telefono: null,
    });

    await service.update('EVU53', { telefono: '   ' });

    expect(repository.update).toHaveBeenCalledWith('EVU53', {
      telefono: null,
    });
  });

  it('rechaza body sin campos', async () => {
    await expect(service.update('EVU53', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rechaza razón social vacía', async () => {
    await expect(
      service.update('EVU53', { razonSocial: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('retorna 404 si la empresa no existe', async () => {
    repository.findByCodigo.mockResolvedValue(null);

    await expect(
      service.update('XXXXX', { razonSocial: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
