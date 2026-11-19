import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
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

describe('OrdenVentaService.emitir con la transacción vencida (REQ-348)', () => {
  let service: OrdenVentaService;
  let repository: jest.Mocked<OrdenVentaRepository>;

  const contexto: TenantContext = {
    idUsuario: 'usuario-1',
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

  const orden = {
    idOrdenVenta: idOrden,
    codigoCuenta: 'CTA001',
    idBodega,
    idBodegaDestino: null,
    codigo: 'OV-1',
    estado: EstadoOrdenVenta.por_confirmar,
    cliente: { idCliente: 'cliente-1', nombre: 'Cliente', estaActivo: true },
    comprador: {
      idComprador: 'comprador-1',
      nombre: 'Comprador',
      estaActivo: true,
    },
    bodega: { idBodega, nombre: 'Bodega', estaActiva: true },
    bodegaDestino: null,
    lineas: [
      {
        idProducto: 'producto-1',
        cantidadPedida: new Prisma.Decimal(10),
        precioUnitario: new Prisma.Decimal(1000),
        producto: {
          idProducto: 'producto-1',
          sku: 'SKU-1',
          descripcion: 'Producto 1',
          estaActivo: true,
        },
      },
    ],
  };

  const errorDePrisma = (codigo: string) =>
    new Prisma.PrismaClientKnownRequestError('error de prisma', {
      code: codigo,
      clientVersion: 'test',
    });

  beforeEach(async () => {
    repository = {
      findById: jest.fn().mockResolvedValue(orden),
      emitir: jest.fn(),
    } as unknown as jest.Mocked<OrdenVentaRepository>;

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        OrdenVentaService,
        { provide: OrdenVentaRepository, useValue: repository },
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: jest.fn(),
            $executeRawUnsafe: jest.fn(),
          },
        },
      ],
    }).compile();

    service = modulo.get(OrdenVentaService);
  });

  it('responde 503 con un mensaje claro si la transacción vence (P2028)', async () => {
    repository.emitir.mockRejectedValue(errorDePrisma('P2028'));

    const resultado = service.emitir(idOrden, contexto);

    await expect(resultado).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(resultado).rejects.toThrow(
      'La confirmación tardó más de lo esperado',
    );
  });

  it('deja pasar sin convertir otros errores de Prisma', async () => {
    const otroError = errorDePrisma('P2002');
    repository.emitir.mockRejectedValue(otroError);

    await expect(service.emitir(idOrden, contexto)).rejects.toBe(otroError);
  });

  it('sigue traduciendo los errores de negocio de siempre', async () => {
    repository.emitir.mockRejectedValue(new Error('OV_ESTADO_INVALIDO'));

    await expect(service.emitir(idOrden, contexto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
