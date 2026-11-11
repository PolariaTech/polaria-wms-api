import type { ConfigService } from '@nestjs/config';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type {
  CorreoIngresoFila,
  CorreoIngresoRepository,
} from '../infrastructure/correo-ingreso.repository';
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

const fila = (parcial: Partial<CorreoIngresoFila> = {}): CorreoIngresoFila => ({
  idCorreoIngreso: 'c1',
  messageId: MSG,
  estado: 'procesando',
  idOrdenVenta: null,
  codigoOrdenVenta: null,
  error: null,
  ...parcial,
});

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

const esperarSegundoPlano = () =>
  new Promise<void>((resolver) => setImmediate(resolver));

function montar(cuentas = '023WA') {
  const n8n = { obtener: jest.fn() };
  const ingresos = {
    reservar: jest.fn(),
    buscar: jest.fn(),
    listarEntradas: jest.fn(),
    listarPorMessageIds: jest.fn().mockResolvedValue([]),
    marcarIngresado: jest.fn().mockResolvedValue(undefined),
    marcarError: jest.fn().mockResolvedValue(undefined),
    buscarOvsPorNumeroCorreo: jest.fn().mockResolvedValue([]),
  };
  const pedidoIa = { ingestarPedido: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(cuentas) };
  const servicio = new CorreoDescartadoService(
    n8n as unknown as N8nCorreosClient,
    ingresos as unknown as CorreoIngresoRepository,
    pedidoIa as unknown as PedidoIaService,
    config as unknown as ConfigService,
  );
  return { servicio, n8n, ingresos, pedidoIa };
}

describe('CorreoDescartadoService ingreso (POL-415)', () => {
  it('en el primer intento no busca una OV ya creada', async () => {
    const { servicio, n8n, ingresos, pedidoIa } = montar();
    ingresos.reservar.mockResolvedValue({
      reservada: true,
      fila: fila(),
      numeroIntentos: 1,
    });
    n8n.obtener.mockResolvedValue(correo());
    pedidoIa.ingestarPedido.mockResolvedValue({
      idOrdenVenta: 'ov-uuid',
      codigo: 'OV-1',
      ordenes: [{ idOrdenVenta: 'ov-uuid', codigo: 'OV-1' }],
    });

    await servicio.ingresar(MSG, ctx);
    await esperarSegundoPlano();

    expect(ingresos.buscarOvsPorNumeroCorreo).not.toHaveBeenCalled();
  });

  it('si es un reintento y ya hay OV con el sello, no duplica el pedido', async () => {
    const { servicio, n8n, ingresos, pedidoIa } = montar();
    ingresos.reservar.mockResolvedValue({
      reservada: true,
      fila: fila(),
      numeroIntentos: 2,
    });
    ingresos.buscarOvsPorNumeroCorreo.mockResolvedValue([
      { idOrdenVenta: 'ov-1', codigo: 'OV-1' },
      { idOrdenVenta: 'ov-2', codigo: 'OV-2' },
    ]);

    await servicio.ingresar(MSG, ctx);
    await esperarSegundoPlano();

    expect(ingresos.buscarOvsPorNumeroCorreo).toHaveBeenCalledWith(
      'emp_demo',
      '023WA',
      MSG,
    );
    expect(n8n.obtener).not.toHaveBeenCalled();
    expect(pedidoIa.ingestarPedido).not.toHaveBeenCalled();
    expect(ingresos.marcarIngresado).toHaveBeenCalledWith({
      schemaName: 'emp_demo',
      codigoCuenta: '023WA',
      messageId: MSG,
      idOrdenVenta: 'ov-1',
      codigoOrdenVenta: 'OV-1, OV-2',
    });
  });

  describe('apagado', () => {
    it('espera los procesar en vuelo con tope de 25 s', async () => {
      jest.useFakeTimers();
      const { servicio, n8n, ingresos, pedidoIa } = montar();
      ingresos.reservar.mockResolvedValue({
        reservada: true,
        fila: fila(),
        numeroIntentos: 1,
      });
      n8n.obtener.mockResolvedValue(correo());
      pedidoIa.ingestarPedido.mockReturnValue(new Promise(() => undefined));

      await servicio.ingresar(MSG, ctx);
      const apagado = servicio.beforeApplicationShutdown();
      jest.advanceTimersByTime(25_000);
      await expect(apagado).resolves.toBeUndefined();
      jest.useRealTimers();
    });
  });
});
