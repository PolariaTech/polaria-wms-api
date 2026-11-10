import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { CorreoIngresoRepository } from '../infrastructure/correo-ingreso.repository';
import type {
  CorreoN8nCompleto,
  N8nCorreosClient,
} from '../infrastructure/n8n-correos.client';
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
  parcial: Partial<CorreoN8nCompleto> = {},
): CorreoN8nCompleto => ({
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
      base64: Buffer.from('PDF').toString('base64'),
    },
  ],
  ...parcial,
});

function montar(cuentas = '023WA') {
  const n8n = { obtener: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(cuentas) };
  const servicio = new CorreoDescartadoService(
    n8n as unknown as N8nCorreosClient,
    {} as unknown as CorreoIngresoRepository,
    {} as unknown as PedidoIaService,
    config as unknown as ConfigService,
  );
  return { servicio, n8n };
}

describe('CorreoDescartadoService — contenido y adjuntos (REQ-104)', () => {
  const adjunto = (nombre: string, bytes: string) => ({
    nombre,
    mimeType: 'application/pdf',
    base64: Buffer.from(bytes).toString('base64'),
  });

  it('devuelve el correo y los datos de cada adjunto, sin sus bytes', async () => {
    const { servicio, n8n } = montar();
    n8n.obtener.mockResolvedValue(
      correo({
        adjuntos: [adjunto('a.pdf', '12345'), adjunto('b.pdf', 'xy')],
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
    expect(JSON.stringify(resultado)).not.toContain(
      Buffer.from('12345').toString('base64'),
    );
  });

  it('entrega los bytes del adjunto pedido', async () => {
    const { servicio, n8n } = montar();
    n8n.obtener.mockResolvedValue(
      correo({
        adjuntos: [adjunto('a.pdf', '12345'), adjunto('b.pdf', 'xy')],
      }),
    );

    const resultado = await servicio.adjunto(MSG, 1, ctx);

    expect(resultado.nombre).toBe('b.pdf');
    expect(resultado.mimeType).toBe('application/pdf');
    expect(resultado.buffer.toString()).toBe('xy');
  });

  it('responde 404 si no hay adjunto en esa posición', async () => {
    const { servicio, n8n } = montar();
    n8n.obtener.mockResolvedValue(correo());
    await expect(servicio.adjunto(MSG, 5, ctx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([-1, 100, 1.5, Number.NaN])(
    'rechaza la posición %p sin leer el correo',
    async (indice) => {
      const { servicio, n8n } = montar();
      await expect(servicio.adjunto(MSG, indice, ctx)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(n8n.obtener).not.toHaveBeenCalled();
    },
  );

  it('no lee nada si la cuenta no está habilitada', async () => {
    const { servicio, n8n } = montar('OTRA');
    await expect(servicio.contenido(MSG, ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(servicio.adjunto(MSG, 0, ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(n8n.obtener).not.toHaveBeenCalled();
  });
});
