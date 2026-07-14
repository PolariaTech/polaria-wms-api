import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BodegaTipo,
  DestinoTipo,
  RolNivel,
  WmsRol,
} from '../../../generated/prisma/client';
import { BodegaDestinoRepository } from '../infrastructure/bodega-destino.repository';
import { BodegaDestinoService } from './bodega-destino.service';

describe('BodegaDestinoService', () => {
  let service: BodegaDestinoService;
  let repository: jest.Mocked<BodegaDestinoRepository>;

  const idBodegaInterna = '550e8400-e29b-41d4-a716-446655440000';
  const idBodegaExterna = '550e8400-e29b-41d4-a716-446655440001';

  const operadorContext = {
    idUsuario: 'usr-operador',
    idRol: WmsRol.operador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    idBodegas: [],
  };

  const bodegaInterna = {
    idBodega: idBodegaInterna,
    codigoCuenta: 'CTA001',
    codigo: 'BOD-INT',
    nombre: 'Bodega Interna',
    tipo: BodegaTipo.interna,
    capacidadSlots: 10,
    estaActiva: true,
  };

  const bodegaExterna = {
    idBodega: idBodegaExterna,
    codigoCuenta: 'CTA001',
    codigo: 'BOD-EXT',
    nombre: 'Bodega Externa',
    tipo: BodegaTipo.externa,
    capacidadSlots: null,
    estaActiva: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BodegaDestinoService,
        {
          provide: BodegaDestinoRepository,
          useValue: {
            listActivasByCuentaYTipo: jest.fn(),
            findById: jest.fn(),
            countSlotsLibresAlmacenamientoByBodega: jest.fn(),
            resolveSlotsLibres: jest.fn((bodega, libres: number) => {
              if (libres > 0) return libres;
              if (bodega.tipo === BodegaTipo.externa) {
                return bodega.capacidadSlots ?? 1;
              }
              return 0;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(BodegaDestinoService);
    repository = module.get(BodegaDestinoRepository);
  });

  it('lista bodegas internas con slots libres', async () => {
    repository.listActivasByCuentaYTipo.mockResolvedValue([bodegaInterna]);
    repository.countSlotsLibresAlmacenamientoByBodega.mockResolvedValue(
      new Map([[idBodegaInterna, 3]]),
    );

    const result = await service.listBodegasDestino(
      { codigoCuenta: 'CTA001', tipo: DestinoTipo.interna },
      operadorContext,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      idBodega: idBodegaInterna,
      slotsLibres: 3,
    });
  });

  it('excluye bodegas internas sin slots libres', async () => {
    repository.listActivasByCuentaYTipo.mockResolvedValue([bodegaInterna]);
    repository.countSlotsLibresAlmacenamientoByBodega.mockResolvedValue(
      new Map([[idBodegaInterna, 0]]),
    );

    const result = await service.listBodegasDestino(
      { codigoCuenta: 'CTA001', tipo: DestinoTipo.interna },
      operadorContext,
    );

    expect(result).toHaveLength(0);
  });

  it('incluye bodegas externas sin layout usando capacidad declarada', async () => {
    repository.listActivasByCuentaYTipo.mockResolvedValue([bodegaExterna]);
    repository.countSlotsLibresAlmacenamientoByBodega.mockResolvedValue(
      new Map([[idBodegaExterna, 0]]),
    );

    const result = await service.listBodegasDestino(
      { codigoCuenta: 'CTA001', tipo: DestinoTipo.externa },
      operadorContext,
    );

    expect(result).toHaveLength(1);
    expect(result[0].slotsLibres).toBe(1);
  });

  it('rechaza cuenta fuera del tenant al listar', async () => {
    await expect(
      service.listBodegasDestino(
        { codigoCuenta: 'CTA999', tipo: DestinoTipo.interna },
        operadorContext,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('valida destino coherente con tipo de bodega', async () => {
    repository.findById.mockResolvedValue(bodegaInterna);
    repository.countSlotsLibresAlmacenamientoByBodega.mockResolvedValue(
      new Map([[idBodegaInterna, 2]]),
    );

    await expect(
      service.validateOrdenDestino(
        {
          codigoCuenta: 'CTA001',
          idBodega: idBodegaInterna,
          destinoTipo: DestinoTipo.externa,
        },
        operadorContext,
      ),
    ).rejects.toThrow('debe ser de tipo externa');
  });

  it('rechaza destino sin capacidad disponible', async () => {
    repository.findById.mockResolvedValue(bodegaInterna);
    repository.countSlotsLibresAlmacenamientoByBodega.mockResolvedValue(
      new Map([[idBodegaInterna, 0]]),
    );

    await expect(
      service.validateOrdenDestino(
        {
          codigoCuenta: 'CTA001',
          idBodega: idBodegaInterna,
          destinoTipo: DestinoTipo.interna,
        },
        operadorContext,
      ),
    ).rejects.toThrow('no tiene capacidad disponible');
  });
});
