import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoProcesamiento, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { SolicitudProcesamientoRepository } from '../infrastructure/solicitud-procesamiento.repository';
import { SolicitudProcesamientoService } from './solicitud-procesamiento.service';

describe('SolicitudProcesamientoService flujo frio', () => {
  let service: SolicitudProcesamientoService;
  let repository: jest.Mocked<SolicitudProcesamientoRepository>;

  const jefeCtx: TenantContext = {
    idUsuario: 'jefe-1',
    idRol: WmsRol.jefe_bodega,
    nivelRol: 'bodega',
    codigoCuenta: 'CTA001',
    idBodegas: ['bodega-1'],
  };

  const operarioCtx: TenantContext = {
    idUsuario: 'operario-1',
    idRol: WmsRol.operario,
    nivelRol: 'bodega',
    codigoCuenta: 'CTA001',
    idBodegas: ['bodega-1'],
  };

  const solicitudPendiente = {
    idSolicitudProcesamiento: 'sp-1',
    codigoCuenta: 'CTA001',
    idBodega: 'bodega-1',
    codigo: 'PROC-000001',
    estado: EstadoProcesamiento.pendiente,
    idOperario: null,
    kilosPrimario: { toString: () => '100' },
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findTareaVinculada: jest.fn(),
      asignarOperario: jest.fn(),
      iniciarEnCurso: jest.fn(),
      toResponse: jest.fn((row) => row),
    } as unknown as jest.Mocked<SolicitudProcesamientoRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudProcesamientoService,
        { provide: SolicitudProcesamientoRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(SolicitudProcesamientoService);
  });

  it('create rechaza stock insuficiente', async () => {
    repository.create.mockRejectedValue(new Error('STOCK_INSUFICIENTE'));

    await expect(
      service.create(
        {
          codigoCuenta: 'CTA001',
          idBodega: 'bodega-1',
          idProductoPrimario: 'p1',
          idProductoSecundario: 'p2',
          kilosPrimario: 500,
        },
        jefeCtx,
      ),
    ).rejects.toThrow('No hay stock suficiente');
  });

  it('asignarOperario delega con id solicitante del jefe', async () => {
    repository.findById.mockResolvedValue(solicitudPendiente as never);
    repository.asignarOperario.mockResolvedValue({
      ...solicitudPendiente,
      idOperario: 'operario-1',
    } as never);

    await service.asignarOperario(
      'sp-1',
      {
        codigoCuenta: 'CTA001',
        idBodega: 'bodega-1',
        idOperario: 'operario-1',
      },
      jefeCtx,
    );

    expect(repository.asignarOperario).toHaveBeenCalledWith(
      solicitudPendiente,
      'operario-1',
      'jefe-1',
    );
  });

  it('iniciar exige tarea con OT previa', async () => {
    repository.findById.mockResolvedValue({
      ...solicitudPendiente,
      idOperario: 'operario-1',
    } as never);
    repository.findTareaVinculada.mockResolvedValue(null);

    await expect(
      service.iniciar(
        'sp-1',
        { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
        operarioCtx,
      ),
    ).rejects.toThrow('debe asignar operario primero');
  });

  it('iniciar rechaza operario distinto al asignado', async () => {
    repository.findById.mockResolvedValue({
      ...solicitudPendiente,
      idOperario: 'otro-operario',
    } as never);
    repository.findTareaVinculada.mockResolvedValue({
      idOrdenTrabajo: 'ot-1',
      idAsignado: 'otro-operario',
    } as never);

    await expect(
      service.iniciar(
        'sp-1',
        { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
        operarioCtx,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('iniciar delega ejecutar OT al repositorio', async () => {
    repository.findById.mockResolvedValue({
      ...solicitudPendiente,
      idOperario: 'operario-1',
    } as never);
    repository.findTareaVinculada.mockResolvedValue({
      idOrdenTrabajo: 'ot-1',
      idAsignado: 'operario-1',
    } as never);
    repository.iniciarEnCurso.mockResolvedValue({
      ...solicitudPendiente,
      estado: EstadoProcesamiento.en_proceso,
    } as never);

    await service.iniciar(
      'sp-1',
      { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
      operarioCtx,
    );

    expect(repository.iniciarEnCurso).toHaveBeenCalledWith(
      expect.objectContaining({ idOperario: 'operario-1' }),
      'ot-1',
      null,
      'operario-1',
    );
  });
});
