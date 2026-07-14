import { Test, TestingModule } from '@nestjs/testing';
import { EstadoOrdenTrabajo, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { OrdenTrabajoRepository } from '../infrastructure/orden-trabajo.repository';
import { OrdenTrabajoService } from '../services/operations.service';
import { OperariosService } from '../services/operarios.service';

describe('OrdenTrabajoService', () => {
  let service: OrdenTrabajoService;
  let repository: jest.Mocked<OrdenTrabajoRepository>;
  let operariosService: jest.Mocked<
    Pick<OperariosService, 'assertOperarioAsignable'>
  >;

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
    operariosService = {
      assertOperarioAsignable: jest.fn().mockResolvedValue(undefined),
    };

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
        idOrdenVenta: orden.idOrdenVenta ?? null,
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
        { provide: OperariosService, useValue: operariosService },
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

  it.each([
    ['a_bodega', { idUbicacionDestino: 'ubic-dest' }],
    ['a_salida', { idUbicacionOrigen: 'ubic-orig' }],
    ['revisar', {}],
    [
      'bodega_a_bodega',
      { idUbicacionOrigen: 'ubic-orig', idUbicacionDestino: 'ubic-dest' },
    ],
  ] as const)(
    'create con idAsignado valida operario para tipoFlujo %s',
    async (tipoFlujo, extra) => {
      repository.create.mockResolvedValue({
        ...ordenMock,
        idAsignado: 'operario-1',
        observaciones: `flujo:${tipoFlujo}`,
      } as never);

      await service.create(
        {
          codigoCuenta: 'CTA001',
          idBodega: 'bodega-1',
          tipoFlujo,
          idAsignado: 'operario-1',
          ...extra,
        },
        ctx,
      );

      expect(operariosService.assertOperarioAsignable).toHaveBeenCalledWith(
        'operario-1',
        'CTA001',
        'bodega-1',
      );
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ idAsignado: 'operario-1', tipoFlujo }),
        'user-1',
      );
    },
  );

  it('create sin idAsignado no valida operario', async () => {
    repository.create.mockResolvedValue(ordenMock as never);

    await service.create(
      {
        codigoCuenta: 'CTA001',
        idBodega: 'bodega-1',
        tipoFlujo: 'revisar',
      },
      ctx,
    );

    expect(operariosService.assertOperarioAsignable).not.toHaveBeenCalled();
  });

  it('create propaga idOrdenVenta al repositorio', async () => {
    repository.create.mockResolvedValue({
      ...ordenMock,
      idOrdenVenta: 'ov-1',
      observaciones: 'flujo:a_salida|OV OV-001',
    } as never);

    await service.create(
      {
        codigoCuenta: 'CTA001',
        idBodega: 'bodega-1',
        tipoFlujo: 'a_salida',
        idUbicacionOrigen: 'ubic-orig',
        idOrdenVenta: 'ov-1',
        observaciones: 'OV OV-001',
      },
      ctx,
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idOrdenVenta: 'ov-1',
        tipoFlujo: 'a_salida',
      }),
      'user-1',
    );
  });
});
