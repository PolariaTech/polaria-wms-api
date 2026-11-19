import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoOrdenVenta,
  RolNivel,
  WmsRol,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { OrdenVentaRepository } from '../infrastructure/orden-venta.repository';
import { OrdenVentaService } from './orden-venta.service';

describe('OrdenVentaService.list', () => {
  let service: OrdenVentaService;
  let repository: jest.Mocked<OrdenVentaRepository>;

  const ctx: TenantContext = {
    idUsuario: 'user-1',
    idRol: WmsRol.jefe_bodega,
    nivelRol: RolNivel.bodega,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    codigosCuentaEmpresa: ['CTA001'],
    idBodegas: ['bodega-1'],
    schemaName: 'emp_andino',
  };

  beforeEach(async () => {
    repository = {
      findById: jest.fn(),
      list: jest.fn(),
      getDisponibleProducto: jest.fn(),
      emitir: jest.fn(),
      toEmitirResponse: jest.fn((orden) => ({
        idOrdenVenta: orden.idOrdenVenta,
        venta: orden.codigo,
        estado: orden.estado,
      })),
    } as unknown as jest.Mocked<OrdenVentaRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdenVentaService,
        { provide: OrdenVentaRepository, useValue: repository },
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: jest.fn(),
            $executeRawUnsafe: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OrdenVentaService);
  });

  it('lista OVs con filtro paraSalida (solo confirmadas)', async () => {
    repository.list.mockResolvedValue([
      {
        idOrdenVenta: 'ov-1',
        codigo: 'OV-001',
        estado: EstadoOrdenVenta.confirmada,
      },
    ] as never);

    const result = await service.list(
      {
        codigoCuenta: 'CTA001',
        idBodega: 'bodega-1',
        paraSalida: true,
      },
      ctx,
    );

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        codigoCuenta: 'CTA001',
        idBodega: 'bodega-1',
        estado: EstadoOrdenVenta.confirmada,
      }),
      'emp_andino',
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.estado).toBe(EstadoOrdenVenta.confirmada);
  });
});
