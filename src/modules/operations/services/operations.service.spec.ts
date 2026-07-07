import { Test, TestingModule } from '@nestjs/testing';
import { EstadoOrdenTrabajo, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { OrdenTrabajoRepository } from '../infrastructure/orden-trabajo.repository';
import { OrdenTrabajoService } from '../services/operations.service';

describe('OrdenTrabajoService', () => {
  let service: OrdenTrabajoService;
  let repository: jest.Mocked<OrdenTrabajoRepository>;

  const ctx: TenantContext = {
    idUsuario: 'user-1',
    idRol: WmsRol.jefe_bodega,
    nivelRol: 'bodega',
    codigoCuenta: 'CTA001',
    idBodegas: ['bodega-1'],
  };

  const ordenMock = {
    idOrdenTrabajo: 'ot-1',
    codigoCuenta: 'CTA001',
    idBodega: 'bodega-1',
    codigo: 'OT-000001',
    estado: EstadoOrdenTrabajo.planificada,
    tipo: 'reabasto',
    idAsignado: null,
    idSolicitante: 'user-1',
    idLote: null,
    idUbicacionOrigen: null,
    idUbicacionDestino: 'ubic-dest',
    idSolicitudProcesamiento: null,
    observaciones: 'flujo:a_bodega',
    createdAt: new Date(),
    updatedAt: new Date(),
    lineas: [],
  };

  beforeEach(async () => {
    repository = {
      list: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      ejecutar: jest.fn(),
      toResponse: jest.fn((orden) => ({
        idOrdenTrabajo: orden.idOrdenTrabajo,
        codigoCuenta: orden.codigoCuenta,
        idBodega: orden.idBodega,
        codigo: orden.codigo,
        estado: orden.estado,
        tipo: orden.tipo,
        tipoFlujo: 'a_bodega',
        idAsignado: orden.idAsignado,
        idSolicitante: orden.idSolicitante,
        idLote: orden.idLote,
        idUbicacionOrigen: orden.idUbicacionOrigen,
        idUbicacionDestino: orden.idUbicacionDestino,
        idSolicitudProcesamiento: orden.idSolicitudProcesamiento,
        observaciones: null,
        createdAt: orden.createdAt,
        updatedAt: orden.updatedAt,
        lineas: [],
      })),
    } as unknown as jest.Mocked<OrdenTrabajoRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdenTrabajoService,
        { provide: OrdenTrabajoRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(OrdenTrabajoService);
  });

  it('create exige destino en a_bodega', async () => {
    await expect(
      service.create(
        {
          codigoCuenta: 'CTA001',
          idBodega: 'bodega-1',
          tipoFlujo: 'a_bodega',
        },
        ctx,
      ),
    ).rejects.toThrow('idUbicacionDestino');
  });

  it('create delega al repositorio', async () => {
    repository.create.mockResolvedValue(ordenMock as never);

    const result = await service.create(
      {
        codigoCuenta: 'CTA001',
        idBodega: 'bodega-1',
        tipoFlujo: 'a_bodega',
        idUbicacionDestino: 'ubic-dest',
      },
      ctx,
    );

    expect(repository.create).toHaveBeenCalled();
    expect(result.codigo).toBe('OT-000001');
  });
});
