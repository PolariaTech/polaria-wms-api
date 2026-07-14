import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoIntegracion,
  RolNivel,
  WmsRol,
} from '../../../generated/prisma/client';
import { SolicitudIntegracionRepository } from '../infrastructure/solicitud-integracion.repository';
import { SolicitudIntegracionService } from './solicitud-integracion.service';

describe('SolicitudIntegracionService', () => {
  let service: SolicitudIntegracionService;
  let repository: jest.Mocked<SolicitudIntegracionRepository>;

  const operadorContext = {
    idUsuario: 'usr-operador',
    idRol: WmsRol.operador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    idBodegas: [],
  };

  const solicitudCreada = {
    idSolicitudIntegracion: '550e8400-e29b-41d4-a716-446655440000',
    codigoCuenta: 'CTA001',
    bodegaExternaId: '550e8400-e29b-41d4-a716-446655440001',
    bodegaExternaNombre: 'Bodega Externa Norte',
    scraping: true,
    api: false,
    csvPlano: false,
    estado: EstadoIntegracion.activo,
    createdAt: new Date('2026-06-22T12:00:00.000Z'),
    cuenta: { nombreComercial: 'Cuenta Demo' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudIntegracionService,
        {
          provide: SolicitudIntegracionRepository,
          useValue: {
            findBodegaExterna: jest.fn(),
            findFirstClienteActivo: jest.fn(),
            findClienteActivo: jest.fn(),
            create: jest.fn(),
            list: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SolicitudIntegracionService);
    repository = module.get(SolicitudIntegracionRepository);

    repository.findBodegaExterna.mockResolvedValue({
      idBodega: '550e8400-e29b-41d4-a716-446655440001',
      nombre: 'Bodega Externa Norte',
      codigoCuenta: 'CTA001',
    });
    repository.findFirstClienteActivo.mockResolvedValue({
      idCliente: '550e8400-e29b-41d4-a716-446655440010',
    });
    repository.create.mockResolvedValue(solicitudCreada);
    repository.list.mockResolvedValue([solicitudCreada]);
  });

  it('crea solicitud para operador de cuenta', async () => {
    const result = await service.create(
      {
        bodegaExternaId: '550e8400-e29b-41d4-a716-446655440001',
        bodegaExternaNombre: 'Bodega Externa Norte',
        tipoIntegracion: 'scraping',
      },
      operadorContext,
    );

    expect(result.tipoIntegracion).toBe('scraping');
    expect(result.codigoCuenta).toBe('CTA001');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        codigoCuenta: 'CTA001',
        idSolicitante: 'usr-operador',
        scraping: true,
      }),
    );
  });

  it('lista solicitudes para configurador con nombre de cuenta', async () => {
    const rows = await service.listForConfigurador();

    expect(rows).toHaveLength(1);
    expect(rows[0].cuentaNombre).toBe('Cuenta Demo');
    expect(repository.list).toHaveBeenCalledWith({}, true);
  });

  it('rechaza operador sin cuenta en contexto', async () => {
    await expect(
      service.create(
        {
          bodegaExternaId: '550e8400-e29b-41d4-a716-446655440001',
          bodegaExternaNombre: 'Bodega Externa Norte',
          tipoIntegracion: 'api',
        },
        { ...operadorContext, codigoCuenta: null },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza bodega externa inexistente', async () => {
    repository.findBodegaExterna.mockResolvedValue(null);

    await expect(
      service.create(
        {
          bodegaExternaId: '550e8400-e29b-41d4-a716-446655440001',
          bodegaExternaNombre: 'Bodega Externa Norte',
          tipoIntegracion: 'csv_plano',
        },
        operadorContext,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rechaza cuenta ajena al tenant', async () => {
    await expect(
      service.create(
        {
          codigoCuenta: 'CTA999',
          bodegaExternaId: '550e8400-e29b-41d4-a716-446655440001',
          bodegaExternaNombre: 'Bodega Externa Norte',
          tipoIntegracion: 'scraping',
        },
        operadorContext,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
