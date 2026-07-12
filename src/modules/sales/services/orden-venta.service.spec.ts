import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoOrdenVenta,
  Prisma,
  RolNivel,
  WmsRol,
} from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { OrdenVentaRepository } from '../infrastructure/orden-venta.repository';
import { OrdenVentaService } from './orden-venta.service';

describe('OrdenVentaService.emitir', () => {
  let service: OrdenVentaService;
  let repository: jest.Mocked<OrdenVentaRepository>;

  const ctx: TenantContext = {
    idUsuario: 'user-1',
    idRol: WmsRol.operador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoCuenta: 'CTA001',
    idBodegas: [],
  };

  const idOrden = '550e8400-e29b-41d4-a716-446655440000';
  const idBodega = '660e8400-e29b-41d4-a716-446655440001';

  const ordenBorrador = {
    idOrdenVenta: idOrden,
    codigoCuenta: 'CTA001',
    idBodega,
    idBodegaDestino: null,
    codigo: 'OV-20260709-160103',
    estado: EstadoOrdenVenta.borrador,
    fechaPedido: new Date('2026-07-08'),
    observaciones: null,
    cliente: { idCliente: 'cli-1', nombre: 'Cliente', estaActivo: true },
    comprador: {
      idComprador: 'comp-1',
      nombre: 'Edgar Escobar',
      estaActivo: true,
    },
    bodega: {
      idBodega,
      nombre: 'Bodega Central',
      estaActiva: true,
      codigoCuenta: 'CTA001',
    },
    bodegaDestino: null,
    lineas: [
      {
        idLineaOrdenVenta: 'linea-1',
        idProducto: 'prod-1',
        cantidadPedida: new Prisma.Decimal(10),
        producto: {
          idProducto: 'prod-1',
          sku: 'SKU-1',
          descripcion: 'Producto 1',
          estaActivo: true,
          metadatosCatalogo: { precio: 1000 },
        },
      },
    ],
  };

  beforeEach(async () => {
    repository = {
      findById: jest.fn(),
      list: jest.fn(),
      getDisponibleProducto: jest.fn(),
      emitir: jest.fn(),
      toEmitirResponse: jest.fn(),
    } as unknown as jest.Mocked<OrdenVentaRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdenVentaService,
        { provide: OrdenVentaRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(OrdenVentaService);
  });

  it('emite OV en borrador con stock suficiente', async () => {
    repository.findById.mockResolvedValue(ordenBorrador as never);
    repository.getDisponibleProducto.mockResolvedValue(new Prisma.Decimal(100));
    repository.emitir.mockResolvedValue({
      idOrdenVenta: idOrden,
      venta: ordenBorrador.codigo,
      estado: EstadoOrdenVenta.confirmada,
    } as never);

    const result = await service.emitir(idOrden, ctx);

    expect(repository.emitir).toHaveBeenCalledWith(ordenBorrador, 'user-1');
    expect(result.estado).toBe(EstadoOrdenVenta.confirmada);
  });

  it('rechaza emitir OV que no está en borrador', async () => {
    repository.findById.mockResolvedValue({
      ...ordenBorrador,
      estado: EstadoOrdenVenta.confirmada,
    } as never);

    await expect(service.emitir(idOrden, ctx)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rechaza emitir OV sin líneas', async () => {
    repository.findById.mockResolvedValue({
      ...ordenBorrador,
      lineas: [],
    } as never);

    await expect(service.emitir(idOrden, ctx)).rejects.toThrow(
      'La venta no tiene productos',
    );
  });

  it('rechaza emitir OV con stock insuficiente', async () => {
    repository.findById.mockResolvedValue(ordenBorrador as never);
    repository.getDisponibleProducto.mockResolvedValue(new Prisma.Decimal(2));

    await expect(service.emitir(idOrden, ctx)).rejects.toThrow(
      'No hay stock suficiente',
    );
  });

  it('retorna 404 si OV no existe', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.emitir(idOrden, ctx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza producto inactivo', async () => {
    repository.findById.mockResolvedValue({
      ...ordenBorrador,
      lineas: [
        {
          ...ordenBorrador.lineas[0],
          producto: {
            ...ordenBorrador.lineas[0].producto,
            estaActivo: false,
          },
        },
      ],
    } as never);

    await expect(service.emitir(idOrden, ctx)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('OrdenVentaService.list', () => {
  let service: OrdenVentaService;
  let repository: jest.Mocked<OrdenVentaRepository>;

  const ctx: TenantContext = {
    idUsuario: 'user-1',
    idRol: WmsRol.jefe_bodega,
    nivelRol: RolNivel.bodega,
    codigoCuenta: 'CTA001',
    idBodegas: ['bodega-1'],
  };

  beforeEach(async () => {
    repository = {
      findById: jest.fn(),
      list: jest.fn(),
      getDisponibleProducto: jest.fn(),
      emitir: jest.fn(),
      toEmitirResponse: jest.fn((orden) => ({
        idOrdenVenta: orden.idOrdenVenta,
        venta: orden.codigo,
        estado: orden.estado,
      })),
    } as unknown as jest.Mocked<OrdenVentaRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdenVentaService,
        { provide: OrdenVentaRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(OrdenVentaService);
  });

  it('lista OVs con filtro paraSalida (solo confirmadas)', async () => {
    repository.list.mockResolvedValue([
      {
        idOrdenVenta: 'ov-1',
        codigo: 'OV-001',
        estado: EstadoOrdenVenta.confirmada,
      },
    ] as never);

    const result = await service.list(
      {
        codigoCuenta: 'CTA001',
        idBodega: 'bodega-1',
        paraSalida: true,
      },
      ctx,
    );

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        codigoCuenta: 'CTA001',
        idBodega: 'bodega-1',
        estado: EstadoOrdenVenta.confirmada,
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.estado).toBe(EstadoOrdenVenta.confirmada);
  });
});
