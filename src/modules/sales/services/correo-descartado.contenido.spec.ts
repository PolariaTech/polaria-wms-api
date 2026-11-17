import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { GmailCorreosClient } from '../infrastructure/gmail-correos.client';
import type { CorreoGmailLeido } from '../infrastructure/gmail-correos.parse';
import type { CorreoIngresoRepository } from '../infrastructure/correo-ingreso.repository';
import { CorreoDescartadoService } from './correo-descartado.service';
import type { PedidoIaService } from './pedido-ia.service';

const MSG = '1a1a198510cde156';

const ctx: TenantContext = {
  idUsuario: 'user-1',
  idRol: WmsRol.operador_cuenta,
  nivelRol: RolNivel.cuenta,
  codigoEmpresa: 'EMP001',
  codigoCuenta: '023WA',
  codigosCuentaEmpresa: ['023WA'],
  idBodegas: [],
  schemaName: 'emp_demo',
};

const correo = (
  parcial: Partial<CorreoGmailLeido> = {},
): CorreoGmailLeido => ({
  asunto: 'Pedido XEL HA',
  de: 'compras@hotel.com',
  para: 'ventas@aguacates.com',
  fecha: '2026-11-03',
  texto: '10 cajas de aguacate',
  html: '',
  adjuntos: [
    {
      nombre: 'pedido.pdf',
      mimeType: 'application/pdf',
      tamano: 3,
      attachmentId: 'att-1',
      datos: null,
    },
  ],
  ...parcial,
});

function montar(cuentas = '023WA') {
  const gmail = { obtener: jest.fn(), descargarAdjunto: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(cuentas) };
  const servicio = new CorreoDescartadoService(
    gmail as unknown as GmailCorreosClient,
    {} as unknown as CorreoIngresoRepository,
    {} as unknown as PedidoIaService,
    config as unknown as ConfigService,
  );
  return { servicio, gmail };
}

describe('CorreoDescartadoService — contenido y adjuntos (REQ-317)', () => {
  const meta = (nombre: string, tamano: number) => ({
    nombre,
    mimeType: 'application/pdf',
    tamano,
    attachmentId: `id-${nombre}`,
    datos: null,
  });

  it('devuelve el correo y los datos de cada adjunto, sin sus bytes', async () => {
    const { servicio, gmail } = montar();
    gmail.obtener.mockResolvedValue(
      correo({
        adjuntos: [meta('a.pdf', 5), meta('b.pdf', 2)],
      }),
    );

    const resultado = await servicio.contenido(MSG, ctx);

    expect(resultado).toMatchObject({
      asunto: 'Pedido XEL HA',
      de: 'compras@hotel.com',
      texto: '10 cajas de aguacate',
    });
    expect(resultado.adjuntos).toEqual([
      { indice: 0, nombre: 'a.pdf', mimeType: 'application/pdf', tamano: 5 },
      { indice: 1, nombre: 'b.pdf', mimeType: 'application/pdf', tamano: 2 },
    ]);
    expect(gmail.descargarAdjunto).not.toHaveBeenCalled();
  });

  it('entrega los bytes del adjunto pedido', async () => {
    const { servicio, gmail } = montar();
    gmail.descargarAdjunto.mockResolvedValue({
      nombre: 'b.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('xy'),
    });

    const resultado = await servicio.adjunto(MSG, 1, ctx);

    expect(gmail.descargarAdjunto).toHaveBeenCalledWith(MSG, 1);
    expect(resultado.nombre).toBe('b.pdf');
    expect(resultado.mimeType).toBe('application/pdf');
    expect(resultado.buffer.toString()).toBe('xy');
  });

  it('responde 404 si no hay adjunto en esa posición', async () => {
    const { servicio, gmail } = montar();
    gmail.descargarAdjunto.mockRejectedValue(new NotFoundException());
    await expect(servicio.adjunto(MSG, 5, ctx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([-1, 100, 1.5, Number.NaN])(
    'rechaza la posición %p sin leer el correo',
    async (indice) => {
      const { servicio, gmail } = montar();
      await expect(servicio.adjunto(MSG, indice, ctx)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(gmail.obtener).not.toHaveBeenCalled();
      expect(gmail.descargarAdjunto).not.toHaveBeenCalled();
    },
  );

  it('no lee nada si la cuenta no está habilitada', async () => {
    const { servicio, gmail } = montar('OTRA');
    await expect(servicio.contenido(MSG, ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(servicio.adjunto(MSG, 0, ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(gmail.obtener).not.toHaveBeenCalled();
    expect(gmail.descargarAdjunto).not.toHaveBeenCalled();
  });
});
