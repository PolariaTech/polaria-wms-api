import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import { WarehouseStateRepository } from '../infrastructure/warehouse-state.repository';
import { WarehouseStateService } from './warehouse-state.service';

describe('WarehouseStateService', () => {
  let service: WarehouseStateService;
  let repository: jest.Mocked<WarehouseStateRepository>;

  const idWs = '550e8400-e29b-41d4-a716-446655440500';
  const idBodega = '550e8400-e29b-41d4-a716-446655440000';

  const operarioContext = {
    idUsuario: 'usr-operario',
    idRol: WmsRol.operario,
    nivelRol: RolNivel.bodega,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    idBodegas: [idBodega],
  };

  const dto = { codigoCuenta: 'CTA001', idBodega };

  const row = {
    idWarehouseState: idWs,
    codigoCuenta: 'CTA001',
    idBodega,
    idUbicacion: '550e8400-e29b-41d4-a716-446655440099',
    idProducto: '550e8400-e29b-41d4-a716-446655440010',
    idLote: null,
    cantidad: { toString: () => '10' },
    cantidadReservada: { toString: () => '0' },
    temperatura: null,
    lockedBy: null,
    lockedAt: null,
    version: 1,
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseStateService,
        {
          provide: WarehouseStateRepository,
          useValue: {
            findById: jest.fn(),
            lock: jest.fn(),
            unlock: jest.fn(),
            list: jest.fn(),
            toResponse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(WarehouseStateService);
    repository = module.get(WarehouseStateRepository);

    repository.toResponse.mockImplementation((r) => ({
      idWarehouseState: r.idWarehouseState,
      codigoCuenta: r.codigoCuenta,
      idBodega: r.idBodega,
      idUbicacion: r.idUbicacion,
      idProducto: r.idProducto,
      idLote: r.idLote,
      cantidad: r.cantidad.toString(),
      cantidadReservada: r.cantidadReservada.toString(),
      temperatura: r.temperatura?.toString() ?? null,
      lockedBy: r.lockedBy,
      lockedAt: r.lockedAt,
      version: r.version,
      updatedAt: r.updatedAt,
    }));
  });

  it('bloquea posición libre', async () => {
    repository.findById.mockResolvedValue(row as never);
    repository.lock.mockResolvedValue({
      ...row,
      lockedBy: operarioContext.idUsuario,
      lockedAt: new Date(),
      version: 2,
    } as never);

    const result = await service.lock(idWs, dto, operarioContext);

    expect(repository.lock).toHaveBeenCalledWith(
      idWs,
      operarioContext.idUsuario,
      undefined,
      false,
    );
    expect(result.lockedBy).toBe(operarioContext.idUsuario);
  });

  it('rechaza lock si otro operario tiene el bloqueo activo', async () => {
    repository.findById.mockResolvedValue({
      ...row,
      lockedBy: 'otro-usuario',
      lockedAt: new Date(),
    } as never);

    await expect(service.lock(idWs, dto, operarioContext)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rechaza unlock de posición inexistente', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.unlock(idWs, dto, operarioContext)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
