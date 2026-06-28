import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoSolicitudCompra,
  RolNivel,
  WmsRol,
} from '../../../generated/prisma/client';
import { SolicitudCompraRepository } from '../infrastructure/solicitud-compra.repository';
import { SolicitudCompraService } from './solicitud-compra.service';

describe('SolicitudCompraService', () => {
  let service: SolicitudCompraService;
  let repository: jest.Mocked<SolicitudCompraRepository>;

  const idSolicitud = '550e8400-e29b-41d4-a716-446655440100';
  const idBodega = '550e8400-e29b-41d4-a716-446655440000';
  const idProveedor = '550e8400-e29b-41d4-a716-446655440001';
  const idProducto = '550e8400-e29b-41d4-a716-446655440010';

  const operadorContext = {
    idUsuario: 'usr-operador',
    idRol: WmsRol.operador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    idBodegas: [],
  };

  const adminContext = {
    ...operadorContext,
    idUsuario: 'usr-admin',
    idRol: WmsRol.administrador_cuenta,
  };

  const createDto = {
    codigoCuenta: 'CTA001',
    idBodega,
    idProveedor,
    observaciones: 'Test',
    lineas: [{ idProducto, cantidad: 10 }],
  };

  const solicitudRecord = {
    idSolicitudCompra: idSolicitud,
    codigoCuenta: 'CTA001',
    idBodega,
    idProveedor,
    idOrdenCompra: null,
    codigo: 'SOL-000001',
    estado: EstadoSolicitudCompra.borrador,
    idSolicitante: operadorContext.idUsuario,
    observaciones: 'Test',
    createdAt: new Date(),
    updatedAt: new Date(),
    lineas: [
      {
        idLineaSolicitudCompra: 'line-1',
        idProducto,
        cantidad: { toString: () => '10' },
      },
    ],
  };

  const solicitudResponse = {
    idSolicitudCompra: idSolicitud,
    codigoCuenta: 'CTA001',
    idBodega,
    idProveedor,
    idOrdenCompra: null,
    codigo: 'SOL-000001',
    estado: EstadoSolicitudCompra.borrador,
    idSolicitante: operadorContext.idUsuario,
    observaciones: 'Test',
    createdAt: solicitudRecord.createdAt,
    updatedAt: solicitudRecord.updatedAt,
    lineas: [
      {
        idLineaSolicitudCompra: 'line-1',
        idProducto,
        cantidad: '10',
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudCompraService,
        {
          provide: SolicitudCompraRepository,
          useValue: {
            findBodega: jest.fn(),
            findProveedor: jest.fn(),
            findProductos: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            list: jest.fn(),
            update: jest.fn(),
            updateEstado: jest.fn(),
            toResponse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SolicitudCompraService);
    repository = module.get(SolicitudCompraRepository);

    repository.findBodega.mockResolvedValue({
      idBodega,
      codigoCuenta: 'CTA001',
      estaActiva: true,
    });
    repository.findProveedor.mockResolvedValue({
      idProveedor,
      codigoCuenta: 'CTA001',
      estaActivo: true,
    });
    repository.findProductos.mockResolvedValue([
      { idProducto, codigoCuenta: 'CTA001', estaActivo: true },
    ]);
    repository.toResponse.mockImplementation((s) => ({
      idSolicitudCompra: s.idSolicitudCompra,
      codigoCuenta: s.codigoCuenta,
      idBodega: s.idBodega,
      idProveedor: s.idProveedor,
      idOrdenCompra: s.idOrdenCompra ?? null,
      codigo: s.codigo,
      estado: s.estado,
      idSolicitante: s.idSolicitante,
      observaciones: s.observaciones,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      lineas: s.lineas.map(
        (linea: {
          idLineaSolicitudCompra: string;
          idProducto: string;
          cantidad: { toString: () => string };
        }) => ({
          idLineaSolicitudCompra: linea.idLineaSolicitudCompra,
          idProducto: linea.idProducto,
          cantidad: linea.cantidad.toString(),
        }),
      ),
    }));
  });

  it('crea solicitud en borrador con idSolicitante del contexto', async () => {
    repository.create.mockResolvedValue(solicitudRecord as never);

    const result = await service.create(createDto, operadorContext);

    expect(result.codigo).toBe('SOL-000001');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        codigoCuenta: 'CTA001',
        idBodega,
      }),
      operadorContext.idUsuario,
    );
  });

  it('rechaza cuenta distinta al tenant', async () => {
    await expect(
      service.create(
        { ...createDto, codigoCuenta: 'CTA999' },
        operadorContext,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza bodega de otra cuenta', async () => {
    repository.findBodega.mockResolvedValue({
      idBodega,
      codigoCuenta: 'CTA999',
      estaActiva: true,
    });

    await expect(service.create(createDto, operadorContext)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza producto de otra cuenta', async () => {
    repository.findProductos.mockResolvedValue([
      { idProducto, codigoCuenta: 'CTA999', estaActivo: true },
    ]);

    await expect(service.create(createDto, operadorContext)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza edición fuera de borrador', async () => {
    repository.findById.mockResolvedValue({
      ...solicitudRecord,
      estado: EstadoSolicitudCompra.pendiente_aprobacion,
    } as never);

    await expect(
      service.update(idSolicitud, { observaciones: 'x' }, operadorContext),
    ).rejects.toThrow(BadRequestException);
  });

  it('envía a aprobación desde borrador', async () => {
    repository.findById.mockResolvedValue(solicitudRecord as never);
    repository.updateEstado.mockResolvedValue({
      ...solicitudRecord,
      estado: EstadoSolicitudCompra.pendiente_aprobacion,
    } as never);

    const result = await service.enviarAprobacion(idSolicitud, operadorContext);

    expect(result.estado).toBe(EstadoSolicitudCompra.pendiente_aprobacion);
  });

  it('rechaza enviar a aprobación sin proveedor', async () => {
    repository.findById.mockResolvedValue({
      ...solicitudRecord,
      idProveedor: null,
    } as never);

    await expect(
      service.enviarAprobacion(idSolicitud, operadorContext),
    ).rejects.toThrow(BadRequestException);
  });

  it('aprueba solicitud pendiente', async () => {
    repository.findById.mockResolvedValue({
      ...solicitudRecord,
      estado: EstadoSolicitudCompra.pendiente_aprobacion,
    } as never);
    repository.updateEstado.mockResolvedValue({
      ...solicitudRecord,
      estado: EstadoSolicitudCompra.aprobada,
    } as never);

    const result = await service.aprobar(idSolicitud, adminContext);

    expect(result.estado).toBe(EstadoSolicitudCompra.aprobada);
  });

  it('rechaza solicitud pendiente con motivo', async () => {
    repository.findById.mockResolvedValue({
      ...solicitudRecord,
      estado: EstadoSolicitudCompra.pendiente_aprobacion,
    } as never);
    repository.updateEstado.mockResolvedValue({
      ...solicitudRecord,
      estado: EstadoSolicitudCompra.rechazada,
      observaciones: 'Test\nRechazo: Presupuesto',
    } as never);

    const result = await service.rechazar(
      idSolicitud,
      { motivo: 'Presupuesto' },
      adminContext,
    );

    expect(result.estado).toBe(EstadoSolicitudCompra.rechazada);
    expect(repository.updateEstado).toHaveBeenCalledWith(
      idSolicitud,
      EstadoSolicitudCompra.rechazada,
      'Test\nRechazo: Presupuesto',
    );
  });

  it('cancela solicitud en borrador', async () => {
    repository.findById.mockResolvedValue(solicitudRecord as never);
    repository.updateEstado.mockResolvedValue({
      ...solicitudRecord,
      estado: EstadoSolicitudCompra.cancelada,
    } as never);

    const result = await service.cancelar(idSolicitud, operadorContext);

    expect(result.estado).toBe(EstadoSolicitudCompra.cancelada);
  });

  it('retorna 404 si solicitud no existe', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.findById(idSolicitud, operadorContext),
    ).rejects.toThrow(NotFoundException);
  });

  it('lista solicitudes aplicando filtros del repositorio', async () => {
    repository.list.mockResolvedValue([solicitudRecord as never]);

    const result = await service.list(
      { estado: EstadoSolicitudCompra.borrador },
      operadorContext,
    );

    expect(result).toHaveLength(1);
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        codigoCuenta: 'CTA001',
        estado: EstadoSolicitudCompra.borrador,
      }),
    );
  });
});
