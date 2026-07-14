import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoOrdenCompra,
  Prisma,
  RolNivel,
  WmsRol,
} from '../../../generated/prisma/client';
import { RecepcionCompraRepository } from '../infrastructure/recepcion-compra.repository';
import { RecepcionCompraService } from './recepcion-compra.service';

describe('RecepcionCompraService', () => {
  let service: RecepcionCompraService;
  let repository: jest.Mocked<RecepcionCompraRepository>;

  const idOrden = '550e8400-e29b-41d4-a716-446655440200';
  const idBodega = '550e8400-e29b-41d4-a716-446655440000';
  const idLinea = '550e8400-e29b-41d4-a716-446655440201';
  const idProducto = '550e8400-e29b-41d4-a716-446655440010';

  const custodioContext = {
    idUsuario: 'usr-custodio',
    idRol: WmsRol.custodio,
    nivelRol: RolNivel.bodega,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    idBodegas: [idBodega],
  };

  const dto = {
    codigoCuenta: 'CTA001',
    idBodega,
    lineas: [
      {
        idLineaOrdenCompra: idLinea,
        cantidadRecibida: 50,
        temperaturaRegistrada: -18,
      },
    ],
  };

  const recepcionRecord = {
    idRecepcion: '550e8400-e29b-41d4-a716-446655440300',
    codigoCuenta: 'CTA001',
    idBodega,
    idOrdenCompra: idOrden,
    sinDiferencias: true,
    notas: null,
    cerradaAt: new Date(),
    cerradaPor: custodioContext.idUsuario,
    createdAt: new Date(),
    ordenCompra: { estado: EstadoOrdenCompra.recibida },
    lineas: [
      {
        idLineaRecepcion: 'line-rec-1',
        idLineaOrdenCompra: idLinea,
        idProducto: null,
        cantidadRecibida: { toString: () => '50' },
        temperaturaRegistrada: null,
        esAdicional: false,
        tituloSnapshot: null,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecepcionCompraService,
        {
          provide: RecepcionCompraRepository,
          useValue: {
            findOrdenCompra: jest.fn(),
            cerrarRecepcion: jest.fn(),
            findById: jest.fn(),
            findByOrdenCompra: jest.fn(),
            list: jest.fn(),
            toResponse: jest.fn(),
            findProductosRangoTemperatura: jest.fn(),
            findNextUbicacionIngresoLibre: jest.fn(),
            findUbicacionIngreso: jest.fn(),
            countUbicacionesIngreso: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(RecepcionCompraService);
    repository = module.get(RecepcionCompraRepository);

    repository.toResponse.mockImplementation((r) => ({
      idRecepcion: r.idRecepcion,
      codigoCuenta: r.codigoCuenta,
      idBodega: r.idBodega,
      idOrdenCompra: r.idOrdenCompra,
      sinDiferencias: r.sinDiferencias,
      notas: r.notas,
      cerradaAt: r.cerradaAt,
      cerradaPor: r.cerradaPor,
      createdAt: r.createdAt,
      estadoOrdenCompra: r.ordenCompra.estado,
      lineas: r.lineas.map((linea) => ({
        idLineaRecepcion: linea.idLineaRecepcion,
        idLineaOrdenCompra: linea.idLineaOrdenCompra,
        idProducto: linea.idProducto,
        cantidadRecibida: linea.cantidadRecibida.toString(),
        temperaturaRegistrada: linea.temperaturaRegistrada?.toString() ?? null,
        esAdicional: linea.esAdicional,
        tituloSnapshot: linea.tituloSnapshot,
      })),
    }));
  });

  it('cierra recepción contra OC emitida', async () => {
    repository.findOrdenCompra.mockResolvedValue({
      idOrdenCompra: idOrden,
      codigoCuenta: 'CTA001',
      idBodega,
      estado: EstadoOrdenCompra.emitida,
      recepcion: null,
      lineas: [
        {
          idLineaOrdenCompra: idLinea,
          idProducto,
          cantidad: new Prisma.Decimal(50),
          cantidadRecibida: new Prisma.Decimal(0),
        },
      ],
    } as never);

    repository.findProductosRangoTemperatura.mockResolvedValue([
      {
        idProducto,
        sku: 'SKU-1',
        rangoTemperaturaMin: null,
        rangoTemperaturaMax: null,
      },
    ] as never);
    repository.findNextUbicacionIngresoLibre.mockResolvedValue({
      idUbicacion: '550e8400-e29b-41d4-a716-446655440099',
    } as never);
    repository.findUbicacionIngreso.mockResolvedValue({
      idUbicacion: '550e8400-e29b-41d4-a716-446655440099',
    } as never);

    repository.cerrarRecepcion.mockResolvedValue(recepcionRecord as never);

    const result = await service.cerrar(idOrden, dto, custodioContext);

    expect(repository.cerrarRecepcion).toHaveBeenCalled();
    expect(result.idRecepcion).toBe(recepcionRecord.idRecepcion);
    expect(result.estadoOrdenCompra).toBe(EstadoOrdenCompra.recibida);
  });

  it('rechaza OC inexistente', async () => {
    repository.findOrdenCompra.mockResolvedValue(null);

    await expect(service.cerrar(idOrden, dto, custodioContext)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza OC ya recepcionada', async () => {
    repository.findOrdenCompra.mockResolvedValue({
      idOrdenCompra: idOrden,
      codigoCuenta: 'CTA001',
      idBodega,
      estado: EstadoOrdenCompra.recibida,
      recepcion: { idRecepcion: 'existing' },
      lineas: [],
    } as never);

    await expect(service.cerrar(idOrden, dto, custodioContext)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('valida tenant contra la OC, no solo contra el body', async () => {
    repository.findOrdenCompra.mockResolvedValue({
      idOrdenCompra: idOrden,
      codigoCuenta: 'CTA001',
      idBodega,
      estado: EstadoOrdenCompra.emitida,
      recepcion: null,
      lineas: [
        {
          idLineaOrdenCompra: idLinea,
          idProducto,
          cantidad: new Prisma.Decimal(50),
          cantidadRecibida: new Prisma.Decimal(0),
        },
      ],
    } as never);

    await expect(
      service.cerrar(
        idOrden,
        { ...dto, codigoCuenta: 'CTA999' },
        custodioContext,
      ),
    ).rejects.toThrow('no coinciden con la orden de compra');
  });
});
