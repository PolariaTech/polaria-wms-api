import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
import { uploadOvAdjuntoBuffer } from '../ai/upload-ov-adjunto-cloudinary';
import { RegistrarSeguimientoService } from './registrar-seguimiento.service';

jest.mock('../ai/upload-ov-adjunto-cloudinary', () => ({
  uploadOvAdjuntoBuffer: jest.fn(),
}));

const upload = uploadOvAdjuntoBuffer as jest.MockedFunction<
  typeof uploadOvAdjuntoBuffer
>;

describe('RegistrarSeguimientoService.registrarSeguimiento', () => {
  let prisma: { $queryRawUnsafe: jest.Mock; $executeRawUnsafe: jest.Mock };
  let locator: {
    findCuentaByCodigo: jest.Mock;
    assertSafeSchemaIdent: jest.Mock;
  };
  let service: RegistrarSeguimientoService;

  const orden = {
    idOrdenVenta: '550e8400-e29b-41d4-a716-446655440000',
    codigo: 'OV-00000023',
    origenArchivos: JSON.stringify([
      { nombre: 'correo.eml', path: '023wa/8f3a-correo.eml' },
    ]),
  };

  const eml = {
    originalname: 'correo.eml',
    mimetype: 'message/rfc822',
    buffer: Buffer.from('From: a@b.c'),
    size: 12,
  } as Express.Multer.File;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([orden]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
    locator = {
      findCuentaByCodigo: jest.fn().mockResolvedValue({
        codigoCuenta: '023WA',
        codigoEmpresa: 'EMP',
        nombreComercial: 'Aguacates',
        estaActiva: true,
        schemaName: 'emp_andino',
        empresaEstaActiva: true,
      }),
      assertSafeSchemaIdent: jest.fn((schema: string) => schema),
    };
    upload.mockReset();
    upload.mockResolvedValue({
      ok: true,
      adjunto: {
        nombre: 'seguimiento-19c4a2.eml',
        url: 'https://example.test/seguimiento-19c4a2.eml',
        path: '023wa/b772-seguimiento-19c4a2.eml',
        mime: 'message/rfc822',
        bytes: 12,
        resourceType: 'storage',
      },
    });
    service = new RegistrarSeguimientoService(
      prisma as unknown as PrismaService,
      locator as unknown as TenantSchemaLocator,
    );
  });

  function pedir(extra: {
    codigoCuenta?: string;
    ordenCompra?: string;
    codigo?: string;
    numeroCorreo?: string;
    files?: Express.Multer.File[];
  } = {}) {
    return service.registrarSeguimiento({
      codigoCuenta: '023WA',
      ordenCompra: '4501084810',
      numeroCorreo: '19c4a2',
      files: [eml],
      ...extra,
    });
  }

  it('rechaza si falta codigoCuenta', async () => {
    await expect(pedir({ codigoCuenta: '  ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('rechaza si no hay orden de compra ni código', async () => {
    await expect(
      pedir({ ordenCompra: '', codigo: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(locator.findCuentaByCodigo).not.toHaveBeenCalled();
  });

  it('rechaza si no viene el .eml', async () => {
    await expect(
      pedir({
        files: [
          {
            originalname: 'pedido.pdf',
            mimetype: 'application/pdf',
            buffer: Buffer.from('%PDF'),
            size: 4,
          } as Express.Multer.File,
        ],
      }),
    ).rejects.toThrow('Falta el archivo .eml de seguimiento.');
  });

  it('responde 404 si no hay una orden activa', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    await expect(pedir()).rejects.toBeInstanceOf(NotFoundException);
    expect(upload).not.toHaveBeenCalled();
  });

  it('responde 409 si hay varias compras y no llega el código', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      orden,
      { ...orden, idOrdenVenta: '660e8400-e29b-41d4-a716-446655440001', codigo: 'OV-00000024' },
    ]);
    await expect(pedir()).rejects.toBeInstanceOf(ConflictException);
    expect(upload).not.toHaveBeenCalled();
  });

  it('no vuelve a subir el seguimiento si el nombre ya está en la orden', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        ...orden,
        origenArchivos: JSON.stringify([
          { nombre: 'correo.eml', path: '023wa/8f3a-correo.eml' },
          {
            nombre: 'seguimiento-19c4a2.eml',
            path: '023wa/b772-seguimiento-19c4a2.eml',
          },
        ]),
      },
    ]);
    const result = await pedir();
    expect(result).toEqual({
      idOrdenVenta: orden.idOrdenVenta,
      codigo: orden.codigo,
      nombre: 'seguimiento-19c4a2.eml',
      path: '023wa/b772-seguimiento-19c4a2.eml',
      agregado: false,
    });
    expect(upload).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('responde no disponible si la subida del .eml falla', async () => {
    upload.mockResolvedValue({
      ok: false,
      message: 'No se pudo preparar bucket ov-adjuntos.',
    });
    await expect(pedir()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('agrega el seguimiento a origen_archivos sin borrar el correo original', async () => {
    const result = await pedir();
    const update = prisma.$executeRawUnsafe.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE'),
    );
    expect(update).toBeDefined();
    expect(JSON.parse(String(update?.[1]))).toEqual([
      { nombre: 'correo.eml', path: '023wa/8f3a-correo.eml' },
      {
        nombre: 'seguimiento-19c4a2.eml',
        url: 'https://example.test/seguimiento-19c4a2.eml',
        path: '023wa/b772-seguimiento-19c4a2.eml',
        mime: 'message/rfc822',
        bytes: 12,
        resourceType: 'storage',
      },
    ]);
    expect(result.agregado).toBe(true);
    expect(result.nombre).toBe('seguimiento-19c4a2.eml');
  });

  it('traduce un fallo del SELECT a servicio no disponible', async () => {
    prisma.$queryRawUnsafe.mockRejectedValue(new Error('timeout'));
    await expect(pedir()).rejects.toThrow(
      'No se pudo consultar la orden de venta.',
    );
  });

  it('traduce un fallo del UPDATE a servicio no disponible', async () => {
    prisma.$executeRawUnsafe.mockRejectedValue(new Error('timeout'));
    await expect(pedir()).rejects.toThrow(
      'No se pudo guardar el seguimiento en la orden.',
    );
  });

  it('responde 404 si el UPDATE no toca ninguna fila', async () => {
    prisma.$executeRawUnsafe.mockResolvedValue(0);
    await expect(pedir()).rejects.toBeInstanceOf(NotFoundException);
  });
});
