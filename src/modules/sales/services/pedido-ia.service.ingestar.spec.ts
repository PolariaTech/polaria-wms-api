import { BadRequestException } from '@nestjs/common';
import { PedidoIaService } from './pedido-ia.service';

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
