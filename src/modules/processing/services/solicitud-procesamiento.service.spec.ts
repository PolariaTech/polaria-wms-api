import { Test, TestingModule } from '@nestjs/testing';
import { EstadoProcesamiento, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { SolicitudProcesamientoRepository } from '../infrastructure/solicitud-procesamiento.repository';
import { SolicitudProcesamientoService } from '../services/solicitud-procesamiento.service';

describe('SolicitudProcesamientoService', () => {
  let service: SolicitudProcesamientoService;
  let repository: jest.Mocked<SolicitudProcesamientoRepository>;

  const ctx: TenantContext = {
    idUsuario: 'proc-1',
    idRol: WmsRol.procesador,
    nivelRol: 'bodega',
    codigoCuenta: 'CTA001',
    idBodegas: ['bodega-1'],
  };

  const solicitudMock = {
    idSolicitudProcesamiento: 'sp-1',
    codigoCuenta: 'CTA001',
    idBodega: 'bodega-1',
    codigo: 'PROC-000001',
    estado: EstadoProcesamiento.en_proceso,
    kilosPrimario: { toString: () => '500' },
    kilosSecundario: null,
    kilosMerma: null,
    sobranteKg: null,
    idCliente: null,
    idProductoPrimario: 'p1',
    idProductoSecundario: 'p2',
    idSolicitante: 'u1',
    idProcesador: 'proc-1',
    reglaConversionCantidadPrimario: null,
    reglaConversionUnidadesSecundario: null,
    perdidaProcesamientoPct: null,
    estimadoUnidadesSecundario: null,
    kgPrimarioDescontado: null,
    cierreDesdeProcesador: false,
    observaciones: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      findById: jest.fn(),
      cerrar: jest.fn(),
      toResponse: jest.fn(() => ({
        idSolicitudProcesamiento: 'sp-1',
        codigo: 'PROC-000001',
        estado: EstadoProcesamiento.terminada,
      })),
    } as unknown as jest.Mocked<SolicitudProcesamientoRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudProcesamientoService,
        { provide: SolicitudProcesamientoRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(SolicitudProcesamientoService);
  });

  it('cerrar rechaza solicitud no en proceso', async () => {
    repository.findById.mockResolvedValue({
      ...solicitudMock,
      estado: EstadoProcesamiento.pendiente,
    } as never);

    await expect(
      service.cerrar(
        'sp-1',
        {
          codigoCuenta: 'CTA001',
          idBodega: 'bodega-1',
          kilosSecundario: 450,
          kilosMerma: 25,
        },
        ctx,
      ),
    ).rejects.toThrow('Solo se puede cerrar');
  });

  it('cerrar delega al repositorio', async () => {
    repository.findById.mockResolvedValue(solicitudMock as never);
    repository.cerrar.mockResolvedValue({
      ...solicitudMock,
      estado: EstadoProcesamiento.terminada,
    } as never);

    await service.cerrar(
      'sp-1',
      {
        codigoCuenta: 'CTA001',
        idBodega: 'bodega-1',
        kilosSecundario: 450,
        kilosMerma: 25,
      },
      ctx,
    );

    expect(repository.cerrar).toHaveBeenCalled();
  });
});
