import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoOrdenVenta,
  Prisma,
  RolNivel,
  WmsRol,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import { OrdenVentaRepository } from '../infrastructure/orden-venta.repository';
import { OrdenVentaService } from './orden-venta.service';

describe('OrdenVentaService.emitir — bitácora REQ-325', () => {
  const ctx: TenantContext = {
    idUsuario: 'user-1',
    idRol: WmsRol.operador_cuenta,
    nivelRol: RolNivel.cuenta,
    codigoEmpresa: 'EMP001',
    codigoCuenta: 'CTA001',
    codigosCuentaEmpresa: ['CTA001'],
    idBodegas: [],
    schemaName: 'emp_andino',
  };

  const idOrden = '550e8400-e29b-41d4-a716-446655440000';
  const idBodega = '660e8400-e29b-41d4-a716-446655440001';

  const ordenBorrador = {
    idOrdenVenta: idOrden,
    codigoCuenta: 'CTA001',
    idBodega,
    idBodegaDestino: null,
    codigo: 'OV-20260709-160103',
    estado: EstadoOrdenVenta.por_confirmar,
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
        precioUnitario: new Prisma.Decimal(1000),
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

  it('nombra al confirmante en el evento de emisión', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(ordenBorrador),
      emitir: jest.fn().mockResolvedValue({
        idOrdenVenta: idOrden,
        venta: ordenBorrador.codigo,
        estado: EstadoOrdenVenta.confirmada,
      }),
      toEmitirResponse: jest.fn(),
      list: jest.fn(),
      getDisponibleProducto: jest.fn(),
    } as unknown as jest.Mocked<OrdenVentaRepository>;

    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ origenCorreo: [] }]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ nombre: 'Andrés' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdenVentaService,
        { provide: OrdenVentaRepository, useValue: repository },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    const service = module.get(OrdenVentaService);
    await service.emitir(idOrden, ctx);

    const payloadArg = prisma.$executeRawUnsafe.mock.calls[0]?.[6] as string;
    const payload = JSON.parse(payloadArg) as {
      mensaje: string;
      autorNombre: string;
    };
    expect(payload.autorNombre).toBe('Andrés');
    expect(payload.mensaje).toBe(
      'Pedido confirmado y enviado a bodega por Andrés.',
    );
  });
});
