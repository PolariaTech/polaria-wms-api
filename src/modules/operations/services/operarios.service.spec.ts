import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { OperariosRepository } from '../infrastructure/operarios.repository';
import { SesionOperativaRepository } from '../infrastructure/sesion-operativa.repository';
import { OperariosService } from './operarios.service';

describe('OperariosService', () => {
  let service: OperariosService;
  let operariosRepository: jest.Mocked<OperariosRepository>;
  let sesionRepository: jest.Mocked<SesionOperativaRepository>;

  const jefeCtx: TenantContext = {
    idUsuario: 'jefe-1',
    idRol: WmsRol.jefe_bodega,
    nivelRol: RolNivel.bodega,
    codigoCuenta: 'CTA001',
    idBodegas: ['bodega-1'],
  };

  const operarioCtx: TenantContext = {
    idUsuario: 'operario-1',
    idRol: WmsRol.operario,
    nivelRol: RolNivel.bodega,
    codigoCuenta: 'CTA001',
    idBodegas: ['bodega-1'],
  };

  beforeEach(async () => {
    operariosRepository = {
      findBodegaEnCuenta: jest.fn().mockResolvedValue({
        idBodega: 'bodega-1',
        codigoCuenta: 'CTA001',
      }),
      listOperariosEnBodega: jest.fn().mockResolvedValue([
        {
          idUsuario: 'operario-2',
          nombre: 'María López',
          username: 'maria.lopez',
          estaActivo: true,
        },
        {
          idUsuario: 'operario-1',
          nombre: 'Pedro Ruiz',
          username: 'pedro.ruiz',
          estaActivo: true,
        },
      ]),
      findOperarioEnBodega: jest.fn(),
      countTareasPendientesPorOperario: jest.fn().mockResolvedValue(
        new Map([
          ['operario-1', 3],
          ['operario-2', 1],
        ]),
      ),
    } as unknown as jest.Mocked<OperariosRepository>;

    sesionRepository = {
      findByUsuarios: jest.fn().mockResolvedValue([
        {
          idUsuario: 'operario-1',
          ultimoPing: new Date('2026-07-09T16:19:30.000Z'),
          expiraEn: new Date(Date.now() + 60_000),
        },
      ]),
      upsertPing: jest.fn().mockResolvedValue({}),
      isDisponible: jest.fn(),
    } as unknown as jest.Mocked<SesionOperativaRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperariosService,
        { provide: OperariosRepository, useValue: operariosRepository },
        { provide: SesionOperativaRepository, useValue: sesionRepository },
      ],
    }).compile();

    service = module.get(OperariosService);
  });

  it('listDisponibles ordena por tareas pendientes y usa estaActivo como disponible', async () => {
    const result = await service.listDisponibles(
      { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
      jefeCtx,
    );

    expect(result).toHaveLength(2);
    expect(result[0].idUsuario).toBe('operario-2');
    expect(result[0].tareasPendientes).toBe(1);
    expect(result[0].disponible).toBe(true);
    expect(result[1].idUsuario).toBe('operario-1');
    expect(result[1].tareasPendientes).toBe(3);
    expect(result[1].ultimoPing).toBe('2026-07-09T16:19:30.000Z');
  });

  it('listDisponibles marca no disponible si la cuenta está inactiva', async () => {
    operariosRepository.listOperariosEnBodega.mockResolvedValue([
      {
        idUsuario: 'operario-1',
        nombre: 'Pedro Ruiz',
        username: 'pedro.ruiz',
        estaActivo: false,
      },
    ]);
    operariosRepository.countTareasPendientesPorOperario.mockResolvedValue(
      new Map([['operario-1', 0]]),
    );
    sesionRepository.findByUsuarios.mockResolvedValue([]);

    const result = await service.listDisponibles(
      { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
      jefeCtx,
    );

    expect(result[0].disponible).toBe(false);
    expect(result[0].ultimoPing).toBeNull();
  });

  it('ping actualiza sesión para operario asignado y activo', async () => {
    operariosRepository.findOperarioEnBodega.mockResolvedValue({
      idUsuario: 'operario-1',
      nombre: 'Pedro Ruiz',
      username: 'pedro.ruiz',
      estaActivo: true,
    });

    await service.ping(
      { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
      operarioCtx,
    );

    expect(sesionRepository.upsertPing).toHaveBeenCalledWith(
      'operario-1',
      'CTA001',
      'bodega-1',
    );
  });

  it('ping rechaza operario sin asignación en bodega', async () => {
    operariosRepository.findOperarioEnBodega.mockResolvedValue(null);

    await expect(
      service.ping(
        { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
        operarioCtx,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ping rechaza operario con cuenta inactiva', async () => {
    operariosRepository.findOperarioEnBodega.mockResolvedValue({
      idUsuario: 'operario-1',
      nombre: 'Pedro Ruiz',
      username: 'pedro.ruiz',
      estaActivo: false,
    });

    await expect(
      service.ping(
        { codigoCuenta: 'CTA001', idBodega: 'bodega-1' },
        operarioCtx,
      ),
    ).rejects.toThrow('Tu cuenta de operario no está activa');
  });

  it('assertOperarioAsignable exige cuenta activa, no heartbeat', async () => {
    operariosRepository.findOperarioEnBodega.mockResolvedValue({
      idUsuario: 'operario-1',
      nombre: 'Pedro Ruiz',
      username: 'pedro.ruiz',
      estaActivo: false,
    });

    await expect(
      service.assertOperarioAsignable('operario-1', 'CTA001', 'bodega-1'),
    ).rejects.toThrow('El operario no está activo en el sistema');

    expect(sesionRepository.isDisponible).not.toHaveBeenCalled();
  });

  it('assertOperarioAsignable acepta operario activo sin sesión de presencia', async () => {
    operariosRepository.findOperarioEnBodega.mockResolvedValue({
      idUsuario: 'operario-1',
      nombre: 'Pedro Ruiz',
      username: 'pedro.ruiz',
      estaActivo: true,
    });

    await expect(
      service.assertOperarioAsignable('operario-1', 'CTA001', 'bodega-1'),
    ).resolves.toBeUndefined();

    expect(sesionRepository.isDisponible).not.toHaveBeenCalled();
  });

  it('assertOperarioAsignable rechaza operario inválido', async () => {
    operariosRepository.findOperarioEnBodega.mockResolvedValue(null);

    await expect(
      service.assertOperarioAsignable('operario-x', 'CTA001', 'bodega-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
