import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BodegaTipo, RolNivel, WmsRol } from '../../../generated/prisma/client';
import { BodegaLayoutRepository } from '../infrastructure/bodega-layout.repository';
import { BodegaLayoutBootstrapService } from './bodega-layout-bootstrap.service';

describe('BodegaLayoutBootstrapService', () => {
  let service: BodegaLayoutBootstrapService;
  let repository: jest.Mocked<BodegaLayoutRepository>;

  const idBodega = '550e8400-e29b-41d4-a716-446655440000';

  const bodegaInterna = {
    idBodega,
    codigoCuenta: 'CTA001',
    tipo: BodegaTipo.interna,
    capacidadSlots: 3,
    estaActiva: true,
  };

  const bootstrapResult = {
    idBodega,
    codigoCuenta: 'CTA001',
    capacidadSlots: 3,
    tiposUbicacionCreados: 2,
    zonasCreadas: 1,
    ubicacionesCreadas: 3,
  };

  const adminContext = {
    idUsuario: 'usr-admin',
    idRol: WmsRol.administrador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    idBodegas: [],
  };

  const configuradorContext = {
    idUsuario: 'usr-config',
    idRol: WmsRol.configurador,
    nivelRol: RolNivel.plataforma,
    codigoEmpresa: null,
    codigoCuenta: null,
    idBodegas: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BodegaLayoutBootstrapService,
        {
          provide: BodegaLayoutRepository,
          useValue: {
            findBodega: jest.fn(),
            countUbicaciones: jest.fn(),
            bootstrapLayout: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BodegaLayoutBootstrapService);
    repository = module.get(BodegaLayoutRepository);
  });

  it('bootstrappea layout para administrador_cuenta del mismo tenant', async () => {
    repository.findBodega.mockResolvedValue(bodegaInterna);
    repository.countUbicaciones.mockResolvedValue(0);
    repository.bootstrapLayout.mockResolvedValue(bootstrapResult);

    await expect(
      service.bootstrapLayout(idBodega, adminContext),
    ).resolves.toEqual(bootstrapResult);

    expect(repository.bootstrapLayout).toHaveBeenCalledWith(bodegaInterna, 3);
  });

  it('bootstrappea layout para configurador sin restricción de cuenta', async () => {
    repository.findBodega.mockResolvedValue(bodegaInterna);
    repository.countUbicaciones.mockResolvedValue(0);
    repository.bootstrapLayout.mockResolvedValue(bootstrapResult);

    await expect(
      service.bootstrapLayout(idBodega, configuradorContext),
    ).resolves.toEqual(bootstrapResult);
  });

  it('usa capacidad mínima 1 cuando capacidad_slots es null', async () => {
    repository.findBodega.mockResolvedValue({
      ...bodegaInterna,
      capacidadSlots: null,
    });
    repository.countUbicaciones.mockResolvedValue(0);
    repository.bootstrapLayout.mockResolvedValue({
      ...bootstrapResult,
      capacidadSlots: 1,
      ubicacionesCreadas: 1,
    });

    await service.bootstrapLayout(idBodega, adminContext);

    expect(repository.bootstrapLayout).toHaveBeenCalledWith(
      expect.objectContaining({ capacidadSlots: null }),
      1,
    );
  });

  it('limita capacidad_slots a 500', async () => {
    repository.findBodega.mockResolvedValue({
      ...bodegaInterna,
      capacidadSlots: 999,
    });
    repository.countUbicaciones.mockResolvedValue(0);
    repository.bootstrapLayout.mockResolvedValue({
      ...bootstrapResult,
      capacidadSlots: 500,
      ubicacionesCreadas: 500,
    });

    await service.bootstrapLayout(idBodega, adminContext);

    expect(repository.bootstrapLayout).toHaveBeenCalledWith(
      expect.objectContaining({ capacidadSlots: 999 }),
      500,
    );
  });

  it('rechaza bodega no encontrada', async () => {
    repository.findBodega.mockResolvedValue(null);

    await expect(
      service.bootstrapLayout(idBodega, adminContext),
    ).rejects.toThrow(NotFoundException);
  });

  it('rechaza bodega inactiva', async () => {
    repository.findBodega.mockResolvedValue({
      ...bodegaInterna,
      estaActiva: false,
    });

    await expect(
      service.bootstrapLayout(idBodega, adminContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza bodega externa', async () => {
    repository.findBodega.mockResolvedValue({
      ...bodegaInterna,
      tipo: BodegaTipo.externa,
    });

    await expect(
      service.bootstrapLayout(idBodega, adminContext),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza admin de otra cuenta', async () => {
    repository.findBodega.mockResolvedValue(bodegaInterna);

    await expect(
      service.bootstrapLayout(idBodega, {
        ...adminContext,
        codigoCuenta: 'CTA999',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza si ya existen ubicaciones (409)', async () => {
    repository.findBodega.mockResolvedValue(bodegaInterna);
    repository.countUbicaciones.mockResolvedValue(5);

    await expect(
      service.bootstrapLayout(idBodega, adminContext),
    ).rejects.toThrow(ConflictException);

    expect(repository.bootstrapLayout).not.toHaveBeenCalled();
  });
});
