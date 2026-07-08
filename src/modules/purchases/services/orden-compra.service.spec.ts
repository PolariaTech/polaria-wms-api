import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  DestinoTipo,
  EstadoOrdenCompra,
  EstadoSolicitudCompra,
  RolNivel,
  WmsRol,
} from '../../../generated/prisma/client';
import { OrdenCompraRepository } from '../infrastructure/orden-compra.repository';
import { SolicitudCompraRepository } from '../infrastructure/solicitud-compra.repository';
import { BodegaDestinoService } from './bodega-destino.service';
import { OrdenCompraService } from './orden-compra.service';

describe('OrdenCompraService', () => {
  let service: OrdenCompraService;
  let repository: jest.Mocked<OrdenCompraRepository>;
  let solicitudRepository: jest.Mocked<SolicitudCompraRepository>;
  let bodegaDestinoService: jest.Mocked<BodegaDestinoService>;

  const idOrden = '550e8400-e29b-41d4-a716-446655440200';
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

  const createDto = {
    codigoCuenta: 'CTA001',
    idBodega,
    idProveedor,
    observaciones: 'OC directa',
    lineas: [{ idProducto, cantidad: 50, precioUnitario: 10 }],
  };

  const ordenRecord = {
    idOrdenCompra: idOrden,
    codigoCuenta: 'CTA001',
    idBodega,
    idProveedor,
    idSolicitudCompra: null,
    idCreador: operadorContext.idUsuario,
    codigo: 'OC-000001',
    estado: EstadoOrdenCompra.borrador,
    fechaEmision: new Date('2026-06-28'),
    fechaEntregaEstimada: null,
    destinoTipo: DestinoTipo.interna,
    observaciones: 'OC directa',
    createdAt: new Date(),
    updatedAt: new Date(),
    lineas: [
      {
        idLineaOrdenCompra: 'line-oc-1',
        idProducto,
        cantidad: { toString: () => '50' },
        precioUnitario: { toString: () => '10' },
        cantidadRecibida: { toString: () => '0' },
      },
    ],
  };

  const solicitudAprobada = {
    idSolicitudCompra: idSolicitud,
    codigoCuenta: 'CTA001',
    idBodega,
    idProveedor,
    idOrdenCompra: null,
    codigo: 'SOL-000001',
    estado: EstadoSolicitudCompra.aprobada,
    idSolicitante: operadorContext.idUsuario,
    observaciones: 'SOL origen',
    createdAt: new Date(),
    updatedAt: new Date(),
    lineas: [
      {
        idLineaSolicitudCompra: 'line-sol-1',
        idProducto,
        cantidad: { toString: () => '100' },
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdenCompraService,
        {
          provide: OrdenCompraRepository,
          useValue: {
            findBodega: jest.fn(),
            findProveedor: jest.fn(),
            findProductos: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            list: jest.fn(),
            updateEstado: jest.fn(),
            updateDestino: jest.fn(),
            convertSolicitudToOrden: jest.fn(),
            toResponse: jest.fn(),
          },
        },
        {
          provide: SolicitudCompraRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: BodegaDestinoService,
          useValue: {
            validateOrdenDestino: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OrdenCompraService);
    repository = module.get(OrdenCompraRepository);
    solicitudRepository = module.get(SolicitudCompraRepository);
    bodegaDestinoService = module.get(BodegaDestinoService);

    bodegaDestinoService.validateOrdenDestino.mockResolvedValue(undefined);

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
    repository.toResponse.mockImplementation((orden) => ({
      idOrdenCompra: orden.idOrdenCompra,
      codigoCuenta: orden.codigoCuenta,
      idBodega: orden.idBodega,
      idProveedor: orden.idProveedor,
      idSolicitudCompra: orden.idSolicitudCompra,
      idCreador: orden.idCreador,
      codigo: orden.codigo,
      estado: orden.estado,
      fechaEmision: orden.fechaEmision,
      fechaEntregaEstimada: orden.fechaEntregaEstimada,
      destinoTipo: orden.destinoTipo,
      observaciones: orden.observaciones,
      createdAt: orden.createdAt,
      updatedAt: orden.updatedAt,
      lineas: orden.lineas.map(
        (linea: {
          idLineaOrdenCompra: string;
          idProducto: string;
          cantidad: { toString: () => string };
          precioUnitario: { toString: () => string };
          cantidadRecibida: { toString: () => string };
        }) => ({
          idLineaOrdenCompra: linea.idLineaOrdenCompra,
          idProducto: linea.idProducto,
          cantidad: linea.cantidad.toString(),
          precioUnitario: linea.precioUnitario.toString(),
          cantidadRecibida: linea.cantidadRecibida.toString(),
        }),
      ),
    }));
  });

  it('crea OC en borrador desde cero con idCreador del contexto', async () => {
    repository.create.mockResolvedValue(ordenRecord as never);

    const result = await service.create(createDto, operadorContext);

    expect(result.codigo).toBe('OC-000001');
    expect(result.estado).toBe(EstadoOrdenCompra.borrador);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        codigoCuenta: 'CTA001',
        idProveedor,
      }),
      operadorContext.idUsuario,
    );
  });

  it('rechaza cuenta distinta al tenant al crear OC', async () => {
    await expect(
      service.create({ ...createDto, codigoCuenta: 'CTA999' }, operadorContext),
    ).rejects.toThrow(ForbiddenException);
  });

  it('convierte SOL aprobada en OC vinculada', async () => {
    solicitudRepository.findById.mockResolvedValue(solicitudAprobada as never);
    repository.convertSolicitudToOrden.mockResolvedValue({
      ...ordenRecord,
      idSolicitudCompra: idSolicitud,
      lineas: [
        {
          idLineaOrdenCompra: 'line-oc-1',
          idProducto,
          cantidad: { toString: () => '100' },
          precioUnitario: { toString: () => '0' },
          cantidadRecibida: { toString: () => '0' },
        },
      ],
    } as never);

    const result = await service.convertirDesdeSolicitud(
      idSolicitud,
      operadorContext,
    );

    expect(result.idSolicitudCompra).toBe(idSolicitud);
    expect(repository.convertSolicitudToOrden).toHaveBeenCalledWith(
      expect.objectContaining({
        idSolicitudCompra: idSolicitud,
        idProveedor,
      }),
      operadorContext.idUsuario,
      undefined,
    );
  });

  it('rechaza conversión de SOL no aprobada', async () => {
    solicitudRepository.findById.mockResolvedValue({
      ...solicitudAprobada,
      estado: EstadoSolicitudCompra.borrador,
    } as never);

    await expect(
      service.convertirDesdeSolicitud(idSolicitud, operadorContext),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza conversión de SOL ya convertida', async () => {
    solicitudRepository.findById.mockResolvedValue({
      ...solicitudAprobada,
      idOrdenCompra: idOrden,
    } as never);

    await expect(
      service.convertirDesdeSolicitud(idSolicitud, operadorContext),
    ).rejects.toThrow(BadRequestException);
  });

  it('crea OC desde SOL aprobada vía POST /ordenes con idSolicitudCompra', async () => {
    solicitudRepository.findById.mockResolvedValue(solicitudAprobada as never);
    repository.convertSolicitudToOrden.mockResolvedValue({
      ...ordenRecord,
      idSolicitudCompra: idSolicitud,
    } as never);

    const result = await service.create(
      {
        codigoCuenta: 'CTA001',
        idBodega,
        idSolicitudCompra: idSolicitud,
      },
      operadorContext,
    );

    expect(result.idSolicitudCompra).toBe(idSolicitud);
    expect(repository.convertSolicitudToOrden).toHaveBeenCalled();
  });

  it('emite OC desde borrador', async () => {
    repository.findById.mockResolvedValue(ordenRecord as never);
    repository.updateEstado.mockResolvedValue({
      ...ordenRecord,
      estado: EstadoOrdenCompra.emitida,
    } as never);

    const result = await service.emitir(idOrden, operadorContext);

    expect(result.estado).toBe(EstadoOrdenCompra.emitida);
    expect(bodegaDestinoService.validateOrdenDestino).toHaveBeenCalledWith(
      {
        codigoCuenta: 'CTA001',
        idBodega,
        destinoTipo: DestinoTipo.interna,
      },
      operadorContext,
    );
    expect(repository.updateEstado).toHaveBeenCalledWith(
      idOrden,
      EstadoOrdenCompra.emitida,
    );
  });

  it('actualiza destino de OC en borrador', async () => {
    repository.findById.mockResolvedValue(ordenRecord as never);
    repository.updateDestino.mockResolvedValue({
      ...ordenRecord,
      destinoTipo: DestinoTipo.externa,
      fechaEntregaEstimada: new Date('2026-07-15'),
    } as never);

    const result = await service.updateDestino(
      idOrden,
      {
        destinoTipo: DestinoTipo.externa,
        idBodega,
        fechaEntregaEstimada: '2026-07-15',
      },
      operadorContext,
    );

    expect(result.destinoTipo).toBe(DestinoTipo.externa);
    expect(repository.updateDestino).toHaveBeenCalledWith(
      idOrden,
      expect.objectContaining({
        destinoTipo: DestinoTipo.externa,
        idBodega,
      }),
    );
  });

  it('rechaza actualizar destino si OC no está en borrador', async () => {
    repository.findById.mockResolvedValue({
      ...ordenRecord,
      estado: EstadoOrdenCompra.emitida,
    } as never);

    await expect(
      service.updateDestino(
        idOrden,
        { destinoTipo: DestinoTipo.interna, idBodega },
        operadorContext,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza emitir OC que no está en borrador', async () => {
    repository.findById.mockResolvedValue({
      ...ordenRecord,
      estado: EstadoOrdenCompra.emitida,
    } as never);

    await expect(service.emitir(idOrden, operadorContext)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('cancela OC en borrador', async () => {
    repository.findById.mockResolvedValue(ordenRecord as never);
    repository.updateEstado.mockResolvedValue({
      ...ordenRecord,
      estado: EstadoOrdenCompra.cancelada,
    } as never);

    const result = await service.cancelar(idOrden, operadorContext);

    expect(result.estado).toBe(EstadoOrdenCompra.cancelada);
  });

  it('cancela OC emitida', async () => {
    repository.findById.mockResolvedValue({
      ...ordenRecord,
      estado: EstadoOrdenCompra.emitida,
    } as never);
    repository.updateEstado.mockResolvedValue({
      ...ordenRecord,
      estado: EstadoOrdenCompra.cancelada,
    } as never);

    const result = await service.cancelar(idOrden, operadorContext);

    expect(result.estado).toBe(EstadoOrdenCompra.cancelada);
  });

  it('rechaza cancelar OC parcialmente recibida', async () => {
    repository.findById.mockResolvedValue({
      ...ordenRecord,
      estado: EstadoOrdenCompra.parcialmente_recibida,
    } as never);

    await expect(service.cancelar(idOrden, operadorContext)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('retorna 404 si OC no existe', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.findById(idOrden, operadorContext),
    ).rejects.toThrow(NotFoundException);
  });
});
