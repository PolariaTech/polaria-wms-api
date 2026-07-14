import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoOrdenTrabajo,
  EstadoTarea,
  RolNivel,
  TipoOrdenTrabajo,
  TipoTarea,
  WmsRol,
} from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { OrdenTrabajoRepository } from '../infrastructure/orden-trabajo.repository';
import { TareaColaRepository } from '../infrastructure/tarea-cola.repository';
import { TareaColaService } from './operations.service';

describe('TareaColaService.completar', () => {
  let service: TareaColaService;
  let tareaRepository: jest.Mocked<TareaColaRepository>;
  let ordenRepository: jest.Mocked<OrdenTrabajoRepository>;

  const operarioCtx: TenantContext = {
    idUsuario: 'operario-1',
    idRol: WmsRol.operario,
    nivelRol: RolNivel.bodega,
    codigoCuenta: 'CTA001',
    idBodegas: ['bodega-1'],
  };

  const tareaConOt = {
    idTarea: 'tarea-1',
    codigoCuenta: 'CTA001',
    idBodega: 'bodega-1',
    tipo: TipoTarea.movimiento,
    estado: EstadoTarea.pendiente,
    idAsignado: 'operario-1',
    idOrdenTrabajo: 'ot-1',
    titulo: 'A bodega · OT-000001',
    descripcion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ordenPlanificada = {
    idOrdenTrabajo: 'ot-1',
    codigoCuenta: 'CTA001',
    idBodega: 'bodega-1',
    codigo: 'OT-000001',
    estado: EstadoOrdenTrabajo.planificada,
    tipo: TipoOrdenTrabajo.reabasto,
    idAsignado: 'operario-1',
    idSolicitante: 'jefe-1',
    idLote: null,
    idUbicacionOrigen: 'ubic-origen',
    idUbicacionDestino: 'ubic-destino',
    idSolicitudProcesamiento: null,
    observaciones: 'flujo:a_bodega',
    createdAt: new Date(),
    updatedAt: new Date(),
    lineas: [],
  };

  beforeEach(async () => {
    tareaRepository = {
      findById: jest.fn(),
      completar: jest.fn(),
      toResponse: jest.fn((row) => ({
        idTarea: row.idTarea,
        codigoCuenta: row.codigoCuenta,
        idBodega: row.idBodega,
        tipo: row.tipo,
        estado: row.estado,
        idAsignado: row.idAsignado,
        idOrdenTrabajo: row.idOrdenTrabajo,
        idSolicitudProcesamiento: row.idSolicitudProcesamiento ?? null,
        titulo: row.titulo,
        descripcion: row.descripcion,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    } as unknown as jest.Mocked<TareaColaRepository>;

    ordenRepository = {
      findById: jest.fn(),
      ejecutar: jest.fn(),
    } as unknown as jest.Mocked<OrdenTrabajoRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TareaColaService,
        { provide: TareaColaRepository, useValue: tareaRepository },
        { provide: OrdenTrabajoRepository, useValue: ordenRepository },
      ],
    }).compile();

    service = module.get(TareaColaService);
  });

  it.each([
    ['a_bodega', TipoTarea.movimiento],
    ['bodega_a_bodega', TipoTarea.movimiento],
    ['a_salida', TipoTarea.despacho],
    ['revisar', TipoTarea.revision],
  ] as const)(
    'completar con OT ejecuta orden para tipoFlujo %s',
    async (tipoFlujo, tipoTarea) => {
      const tarea = {
        ...tareaConOt,
        tipo: tipoTarea,
      };
      const orden = {
        ...ordenPlanificada,
        observaciones: `flujo:${tipoFlujo}`,
      };

      tareaRepository.findById
        .mockResolvedValueOnce(tarea as never)
        .mockResolvedValueOnce({
          ...tarea,
          estado: EstadoTarea.completada,
        } as never);
      ordenRepository.findById.mockResolvedValue(orden as never);
      ordenRepository.ejecutar.mockResolvedValue({
        ...orden,
        estado: EstadoOrdenTrabajo.completada,
      } as never);

      const result = await service.completar(
        'tarea-1',
        { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
        operarioCtx,
      );

      expect(ordenRepository.ejecutar).toHaveBeenCalledWith(
        orden,
        { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
        'operario-1',
        { autoResolverStock: true },
      );
      expect(tareaRepository.completar).not.toHaveBeenCalled();
      expect(result.estado).toBe(EstadoTarea.completada);
    },
  );

  it('completar tarea procesamiento con OT solo marca completada (stock en iniciar)', async () => {
    const tarea = {
      ...tareaConOt,
      tipo: TipoTarea.procesamiento,
    };

    tareaRepository.findById.mockResolvedValue(tarea as never);
    tareaRepository.completar.mockResolvedValue({
      ...tarea,
      estado: EstadoTarea.completada,
    } as never);

    await service.completar(
      'tarea-1',
      { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
      operarioCtx,
    );

    expect(ordenRepository.ejecutar).not.toHaveBeenCalled();
    expect(tareaRepository.completar).toHaveBeenCalledWith(
      'tarea-1',
      'operario-1',
    );
  });

  it('completar sin OT delega al repositorio de tarea', async () => {
    const tarea = {
      ...tareaConOt,
      idOrdenTrabajo: null,
      tipo: TipoTarea.procesamiento,
    };

    tareaRepository.findById.mockResolvedValue(tarea as never);
    tareaRepository.completar.mockResolvedValue({
      ...tarea,
      estado: EstadoTarea.completada,
    } as never);

    await service.completar(
      'tarea-1',
      { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
      operarioCtx,
    );

    expect(ordenRepository.ejecutar).not.toHaveBeenCalled();
    expect(tareaRepository.completar).toHaveBeenCalledWith(
      'tarea-1',
      'operario-1',
    );
  });

  it('completar rechaza operario no asignado', async () => {
    tareaRepository.findById.mockResolvedValue({
      ...tareaConOt,
      idAsignado: 'otro-operario',
    } as never);

    await expect(
      service.completar(
        'tarea-1',
        { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
        operarioCtx,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(ordenRepository.ejecutar).not.toHaveBeenCalled();
  });

  it('completar con OT sin stock hace rollback y no completa tarea', async () => {
    tareaRepository.findById.mockResolvedValue(tareaConOt as never);
    ordenRepository.findById.mockResolvedValue(ordenPlanificada as never);
    ordenRepository.ejecutar.mockRejectedValue(
      new Error('WAREHOUSE_STATE_NOT_FOUND'),
    );

    await expect(
      service.completar(
        'tarea-1',
        { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
        operarioCtx,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tareaRepository.completar).not.toHaveBeenCalled();
  });

  it('completar rechaza tarea ya completada', async () => {
    tareaRepository.findById.mockResolvedValue({
      ...tareaConOt,
      estado: EstadoTarea.completada,
    } as never);

    await expect(
      service.completar(
        'tarea-1',
        { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
        operarioCtx,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
