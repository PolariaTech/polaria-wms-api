import { BadRequestException } from '@nestjs/common';
import { GRUPOS_INGEST, PedidoIaService } from './pedido-ia.service';

function crearServicio() {
  const prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
  const config = { get: jest.fn().mockReturnValue('sk-test') };
  const locator = { assertSafeSchemaIdent: (s: string) => s };
  return new PedidoIaService(
    prisma as never,
    config as never,
    locator as never,
  );
}

describe('PedidoIaService.ingestarPedido — correo sin productos (REQ-104)', () => {
  it('si no hay renglones de producto (p. ej. una lista de precios) dice qué falta y no crea la OV', async () => {
    const servicio = crearServicio();
    jest.spyOn(servicio, 'leerPedido').mockResolvedValue({
      origenCorreo: [],
    } as never);

    const intento = servicio.ingestarPedido({
      codigoCuenta: '1YW43',
      texto: 'Nueva lista de precios',
      files: [],
    });

    await expect(intento).rejects.toBeInstanceOf(BadRequestException);
    await expect(intento).rejects.toThrow(
      'No se encontraron productos con cantidades en el correo ni en sus adjuntos, por eso no se creó la OV.',
    );
  });
});

describe('PedidoIaService.ingestarPedido — una OV por día y OC (REQ-197, REQ-245)', () => {
  it('crea una OV por grupo y devuelve todas en `ordenes`, con la primera como principal', async () => {
    const insertadas: unknown[][] = [];
    const prisma = {
      $queryRawUnsafe: jest.fn((sql: string, ...valores: unknown[]) => {
        if (!sql.startsWith('INSERT')) return Promise.resolve([]);
        insertadas.push(valores);
        return Promise.resolve([
          {
            idOrdenVenta: `ov-${insertadas.length}`,
            codigo: `OV-${insertadas.length}`,
          },
        ]);
      }),
    };
    const servicio = new PedidoIaService(
      prisma as never,
      { get: jest.fn().mockReturnValue('sk-test') } as never,
      { assertSafeSchemaIdent: (s: string) => s } as never,
    );
    const privados = servicio as unknown as Record<string, jest.Mock>;
    privados.buildIntegrationTenantContext = jest
      .fn()
      .mockResolvedValue({ schemaName: 'demo' });
    privados.resolveIdBodegaIngest = jest.fn().mockResolvedValue('bodega-1');
    privados.resolveIdClienteIngest = jest.fn().mockResolvedValue('cliente-1');
    privados.subirAdjuntosIngest = jest.fn().mockResolvedValue(null);
    privados.resolveIdCompradorIngest = jest.fn().mockResolvedValue(null);
    privados.auditarOvIngestada = jest.fn().mockResolvedValue(undefined);

    const grupo = (oc: string, producto: string) => ({
      ordenCompraHotel: oc,
      fechaEntrega: '2026-11-07',
      nombreCliente: 'Hotel',
      lineas: [],
      archivosNoLegibles: [],
      advertencia: null,
      origenCorreo: [{ 'Numero pedido': oc, Producto: producto }],
    });
    const leido = grupo('OC-1', 'Aguacate');
    Object.defineProperty(leido, GRUPOS_INGEST, {
      value: [leido, grupo('OC-2', 'Limón')],
    });
    jest.spyOn(servicio, 'leerPedido').mockResolvedValue(leido as never);

    const res = await servicio.ingestarPedido({
      codigoCuenta: '1YW43',
      texto: 'dos pedidos',
      files: [],
    });

    expect(insertadas).toHaveLength(2);
    expect(res.ordenes).toEqual([
      { idOrdenVenta: 'ov-1', codigo: 'OV-1' },
      { idOrdenVenta: 'ov-2', codigo: 'OV-2' },
    ]);
    expect(res.idOrdenVenta).toBe('ov-1');
  });
});

describe('PedidoIaService.ingestarPedido — comprador del correo', () => {
  async function ingestarConNombre(nombreCliente: string, cliente?: string) {
    const prisma = {
      $queryRawUnsafe: jest.fn((sql: string) =>
        Promise.resolve(
          sql.startsWith('INSERT')
            ? [{ idOrdenVenta: 'ov-1', codigo: 'OV-1' }]
            : [],
        ),
      ),
    };
    const servicio = new PedidoIaService(
      prisma as never,
      { get: jest.fn().mockReturnValue('sk-test') } as never,
      { assertSafeSchemaIdent: (s: string) => s } as never,
    );
    const privados = servicio as unknown as Record<string, jest.Mock>;
    privados.buildIntegrationTenantContext = jest
      .fn()
      .mockResolvedValue({ schemaName: 'demo' });
    privados.resolveIdBodegaIngest = jest.fn().mockResolvedValue('bodega-1');
    privados.resolveIdClienteIngest = jest.fn().mockResolvedValue('cliente-1');
    privados.subirAdjuntosIngest = jest.fn().mockResolvedValue(null);
    privados.resolveIdCompradorIngest = jest.fn().mockResolvedValue(null);
    privados.auditarOvIngestada = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(servicio, 'leerPedido').mockResolvedValue({
      ordenCompraHotel: 'OC-1',
      nombreCliente,
      lineas: [],
      archivosNoLegibles: [],
      advertencia: null,
      origenCorreo: [
        {
          'Numero pedido': 'OC-1',
          Producto: 'Aguacate',
          'Nombre cliente': 'Hotel del correo',
        },
      ],
    } as never);

    await servicio.ingestarPedido({
      codigoCuenta: '1YW43',
      texto: 'pedido',
      files: [],
      cliente,
    });
    return privados.resolveIdCompradorIngest;
  }

  it('si la IA devuelve el nombre del cliente vacío, usa el «Nombre cliente» del correo', async () => {
    const resolver = await ingestarConNombre('   ');

    expect(resolver).toHaveBeenCalledWith('demo', '1YW43', 'Hotel del correo');
  });

  it('el nombre que lee la IA manda sobre el del correo', async () => {
    const resolver = await ingestarConNombre('Hotel de la IA');

    expect(resolver).toHaveBeenCalledWith('demo', '1YW43', 'Hotel de la IA');
  });
});
