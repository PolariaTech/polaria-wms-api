import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BodegaTipo,
  Prisma,
  RolNivel,
  WmsRol,
} from '../../../generated/prisma/client';
import { BodegaRepository } from '../infrastructure/bodega.repository';
import { BodegaService } from './bodega.service';

describe('BodegaService', () => {
  let service: BodegaService;
  let repository: jest.Mocked<BodegaRepository>;

  const configuradorContext = {
    idUsuario: 'usr-config',
    idRol: WmsRol.configurador,
    nivelRol: RolNivel.plataforma,
    codigoEmpresa: null,
    codigoCuenta: null,
    idBodegas: [],
  };

  const cuentaActiva = {
    codigoCuenta: 'CTA001',
    codigoEmpresa: 'EMP001',
    estaActiva: true,
    empresa: { estaActiva: true },
  };

  const bodegaCreada = {
    idBodega: '550e8400-e29b-41d4-a716-446655440000',
    codigoCuenta: 'CTA001',
    codigo: 'BOD-CENTRAL',
    nombre: 'Bodega Central',
    tipo: BodegaTipo.interna,
    capacidadSlots: 50,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BodegaService,
        {
          provide: BodegaRepository,
          useValue: {
            findCuenta: jest.fn(),
            createBodega: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BodegaService);
    repository = module.get(BodegaRepository);
    repository.findCuenta.mockResolvedValue(cuentaActiva);
    repository.createBodega.mockResolvedValue(bodegaCreada);
  });

  it('crea bodega interna para configurador', async () => {
    await expect(
      service.create(
        {
          codigoCuenta: 'CTA001',
          codigo: 'BOD-CENTRAL',
          nombre: 'Bodega Central',
          tipo: BodegaTipo.interna,
          capacidadSlots: 50,
        },
        configuradorContext,
      ),
    ).resolves.toEqual(bodegaCreada);

    expect(repository.createBodega).toHaveBeenCalledWith({
      codigoCuenta: 'CTA001',
      codigo: 'BOD-CENTRAL',
      nombre: 'Bodega Central',
      tipo: BodegaTipo.interna,
      capacidadSlots: 50,
      idCreador: 'usr-config',
    });
  });

  it('crea bodega externa', async () => {
    await expect(
      service.create(
        {
          codigoCuenta: 'CTA001',
          codigo: 'BOD-EXT',
          nombre: 'Bodega Externa',
          tipo: BodegaTipo.externa,
          capacidadSlots: 10,
        },
        configuradorContext,
      ),
    ).resolves.toEqual(bodegaCreada);
  });

  it('rechaza sin codigoCuenta', async () => {
    await expect(
      service.create(
        {
          codigo: 'BOD-CENTRAL',
          nombre: 'Bodega Central',
          tipo: BodegaTipo.interna,
          capacidadSlots: 50,
        },
        configuradorContext,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza interna sin capacidadSlots', async () => {
    await expect(
      service.create(
        {
          codigoCuenta: 'CTA001',
          codigo: 'BOD-CENTRAL',
          nombre: 'Bodega Central',
          tipo: BodegaTipo.interna,
        },
        configuradorContext,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza cuenta inexistente', async () => {
    repository.findCuenta.mockResolvedValue(null);

    await expect(
      service.create(
        {
          codigoCuenta: 'CTA001',
          codigo: 'BOD-CENTRAL',
          nombre: 'Bodega Central',
          tipo: BodegaTipo.externa,
          capacidadSlots: 10,
        },
        configuradorContext,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rechaza cuenta inactiva', async () => {
    repository.findCuenta.mockResolvedValue({
      ...cuentaActiva,
      estaActiva: false,
    });

    await expect(
      service.create(
        {
          codigoCuenta: 'CTA001',
          codigo: 'BOD-CENTRAL',
          nombre: 'Bodega Central',
          tipo: BodegaTipo.externa,
          capacidadSlots: 10,
        },
        configuradorContext,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('propaga conflicto de código duplicado', async () => {
    repository.createBodega.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(
        {
          codigoCuenta: 'CTA001',
          codigo: 'BOD-CENTRAL',
          nombre: 'Bodega Central',
          tipo: BodegaTipo.externa,
          capacidadSlots: 10,
        },
        configuradorContext,
      ),
    ).rejects.toThrow(ConflictException);
  });
});
