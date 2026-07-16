import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CuentaRepository } from '../infrastructure/cuenta.repository';
import { CuentaService } from './cuenta.service';

describe('CuentaService', () => {
  let service: CuentaService;
  let repository: jest.Mocked<CuentaRepository>;

  const cuenta = {
    codigoCuenta: '49M04',
    codigoEmpresa: 'EVU53',
    nombreComercial: 'Tecno-Tech',
    estaActiva: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CuentaService,
        {
          provide: CuentaRepository,
          useValue: {
            findByCodigo: jest.fn(),
            findOtrasCuentasEmpresa: jest.fn(),
            findBodegasActivasDeCuenta: jest.fn(),
            update: jest.fn(),
            findBodegasByIds: jest.fn(),
            assignBodegasToCuenta: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CuentaService);
    repository = module.get(CuentaRepository);
    repository.findByCodigo.mockResolvedValue(cuenta);
    repository.update.mockResolvedValue({
      ...cuenta,
      nombreComercial: 'Tecno Tech SA',
      estaActiva: false,
    });
    repository.findBodegasActivasDeCuenta.mockResolvedValue([]);
    repository.findOtrasCuentasEmpresa.mockResolvedValue([]);
    repository.findBodegasByIds.mockResolvedValue([]);
    repository.assignBodegasToCuenta.mockResolvedValue({ count: 0 });
  });

  it('actualiza nombre y credenciales (estaActiva)', async () => {
    await expect(
      service.update('49M04', {
        nombreComercial: 'Tecno Tech SA',
        estaActiva: false,
      }),
    ).resolves.toEqual({
      codigoCuenta: '49M04',
      codigoEmpresa: 'EVU53',
      nombreComercial: 'Tecno Tech SA',
      estaActiva: false,
    });
  });

  it('asigna bodegas nuevas del set deseado', async () => {
    repository.findBodegasActivasDeCuenta.mockResolvedValue([
      { idBodega: 'bod-1' },
    ]);
    repository.findBodegasByIds.mockResolvedValue([
      {
        idBodega: 'bod-2',
        codigoCuenta: 'OTRA',
        cuenta: { codigoEmpresa: 'EVU53' },
      },
    ]);
    repository.assignBodegasToCuenta.mockResolvedValue({ count: 1 });

    await service.update('49M04', {
      idsBodegas: ['bod-1', 'bod-2'],
    });

    expect(repository.assignBodegasToCuenta).toHaveBeenCalledWith('49M04', [
      'bod-2',
    ]);
  });

  it('desvincula bodegas moviéndolas a otra cuenta de la empresa', async () => {
    repository.findBodegasActivasDeCuenta.mockResolvedValue([
      { idBodega: 'bod-1' },
      { idBodega: 'bod-2' },
    ]);
    repository.findOtrasCuentasEmpresa.mockResolvedValue([
      { codigoCuenta: 'OTRA1', nombreComercial: 'Otra' },
    ]);
    repository.assignBodegasToCuenta.mockResolvedValue({ count: 1 });

    await service.update('49M04', {
      idsBodegas: ['bod-1'],
    });

    expect(repository.assignBodegasToCuenta).toHaveBeenCalledWith('OTRA1', [
      'bod-2',
    ]);
  });

  it('rechaza desvincular si no hay otra cuenta en la empresa', async () => {
    repository.findBodegasActivasDeCuenta.mockResolvedValue([
      { idBodega: 'bod-1' },
    ]);
    repository.findOtrasCuentasEmpresa.mockResolvedValue([]);

    await expect(
      service.update('49M04', { idsBodegas: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('retorna 404 si la cuenta no existe', async () => {
    repository.findByCodigo.mockResolvedValue(null);

    await expect(
      service.update('XXXXX', { nombreComercial: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
