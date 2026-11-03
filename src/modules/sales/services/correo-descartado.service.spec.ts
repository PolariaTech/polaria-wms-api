import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { CorreosQueryDto } from '../dto/correos-query.dto';
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

const query: CorreosQueryDto = { modo: 'descartados', pagina: 1, tamano: 25 };

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

/** Deja correr el procesamiento en segundo plano (solo hay promesas ya resueltas). */
const esperarSegundoPlano = () =>
  new Promise<void>((resolver) => setImmediate(resolver));

function montar(cuentas = '023WA') {
  const n8n = { listar: jest.fn(), obtener: jest.fn() };
  const ingresos = {
    reservar: jest.fn(),
    buscar: jest.fn(),
    listarPorMessageIds: jest.fn().mockResolvedValue([]),
    marcarIngresado: jest.fn().mockResolvedValue(undefined),
    marcarError: jest.fn().mockResolvedValue(undefined),
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

describe('CorreoDescartadoService (REQ-104)', () => {
  describe('listar', () => {
    it('cruza cada correo con su estado de ingreso en el WMS', async () => {
      const { servicio, n8n, ingresos } = montar();
      n8n.listar.mockResolvedValue({
        total: 2,
        filas: [
          {
            messageId: MSG,
            asunto: 'A',
            nuevoPedido: false,
            motivo: 'cotización',
          },
          {
            messageId: 'otro-id-1234',
            asunto: 'B',
            nuevoPedido: false,
            motivo: 'factura',
          },
        ],
      });
      ingresos.listarPorMessageIds.mockResolvedValue([
        fila({ estado: 'ingresado', codigoOrdenVenta: 'OV-00001318' }),
      ]);

      const resultado = await servicio.listar(query, ctx);

      expect(n8n.listar).toHaveBeenCalledWith(query);
      expect(ingresos.listarPorMessageIds).toHaveBeenCalledWith(
        'emp_demo',
        '023WA',
        [MSG, 'otro-id-1234'],
      );
      expect(resultado.total).toBe(2);
      expect(resultado.filas[0].ingreso).toMatchObject({
        estado: 'ingresado',
        codigoOrdenVenta: 'OV-00001318',
      });
      expect(resultado.filas[1].ingreso).toBeNull();
    });

    it('rechaza una cuenta que no está habilitada para estos correos', async () => {
      const { servicio, n8n } = montar('1YW43');
      await expect(servicio.listar(query, ctx)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(n8n.listar).not.toHaveBeenCalled();
    });

    it('rechaza si no hay cuentas configuradas', async () => {
      const { servicio, n8n } = montar('');
      await expect(servicio.listar(query, ctx)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(n8n.listar).not.toHaveBeenCalled();
    });
  });

  describe('ingresar', () => {
    it('reserva, responde procesando y crea la OV en segundo plano', async () => {
      const { servicio, n8n, ingresos, pedidoIa } = montar();
      ingresos.reservar.mockResolvedValue({ reservada: true, fila: fila() });
      n8n.obtener.mockResolvedValue(correo());
      pedidoIa.ingestarPedido.mockResolvedValue({
        idOrdenVenta: 'ov-uuid',
        codigo: 'OV-00001319',
      });

      const resultado = await servicio.ingresar(MSG, ctx);
      expect(resultado.estado).toBe('procesando');

      await esperarSegundoPlano();
      expect(pedidoIa.ingestarPedido).toHaveBeenCalledTimes(1);
      const entrada = pedidoIa.ingestarPedido.mock.calls[0][0] as {
        codigoCuenta: string;
        texto: string;
        files: Express.Multer.File[];
      };
      expect(entrada.codigoCuenta).toBe('023WA');
      expect(entrada.texto).toContain('Asunto: Pedido XEL HA');
      expect(entrada.texto).toContain('10 cajas de aguacate');
      expect(entrada.files[0].originalname).toBe('pedido.pdf');
      expect(entrada.files[0].buffer.toString()).toBe('PDF');
      expect(ingresos.marcarIngresado).toHaveBeenCalledWith({
        schemaName: 'emp_demo',
        codigoCuenta: '023WA',
        messageId: MSG,
        idOrdenVenta: 'ov-uuid',
        codigoOrdenVenta: 'OV-00001319',
      });
      expect(ingresos.marcarError).not.toHaveBeenCalled();
    });

    it('un correo ya ingresado responde 409 con la OV y no lo vuelve a leer', async () => {
      const { servicio, n8n, ingresos, pedidoIa } = montar();
      ingresos.reservar.mockResolvedValue({
        reservada: false,
        fila: fila({ estado: 'ingresado', codigoOrdenVenta: 'OV-00001318' }),
      });

      const intento = servicio.ingresar(MSG, ctx);
      await expect(intento).rejects.toBeInstanceOf(ConflictException);
      await expect(intento).rejects.toMatchObject({
        response: {
          error: 'CORREO_YA_INGRESADO',
          message: expect.stringContaining('OV-00001318') as string,
        },
      });
      expect(n8n.obtener).not.toHaveBeenCalled();
      expect(pedidoIa.ingestarPedido).not.toHaveBeenCalled();
    });

    it('un segundo clic mientras procesa devuelve el estado sin duplicar la OV', async () => {
      const { servicio, n8n, ingresos, pedidoIa } = montar();
      ingresos.reservar.mockResolvedValue({
        reservada: false,
        fila: fila({ estado: 'procesando' }),
      });

      const resultado = await servicio.ingresar(MSG, ctx);

      expect(resultado.estado).toBe('procesando');
      await esperarSegundoPlano();
      expect(n8n.obtener).not.toHaveBeenCalled();
      expect(pedidoIa.ingestarPedido).not.toHaveBeenCalled();
    });

    it('si la lectura falla guarda el error para poder reintentar', async () => {
      const { servicio, n8n, ingresos, pedidoIa } = montar();
      ingresos.reservar.mockResolvedValue({ reservada: true, fila: fila() });
      n8n.obtener.mockResolvedValue(correo());
      pedidoIa.ingestarPedido.mockRejectedValue(
        new Error('La IA no extrajo renglones'),
      );

      await servicio.ingresar(MSG, ctx);
      await esperarSegundoPlano();

      expect(ingresos.marcarError).toHaveBeenCalledWith({
        schemaName: 'emp_demo',
        codigoCuenta: '023WA',
        messageId: MSG,
        error: 'La IA no extrajo renglones',
      });
      expect(ingresos.marcarIngresado).not.toHaveBeenCalled();
    });

    it('un correo sin texto ni adjuntos queda en error y no llama a la IA', async () => {
      const { servicio, n8n, ingresos, pedidoIa } = montar();
      ingresos.reservar.mockResolvedValue({ reservada: true, fila: fila() });
      n8n.obtener.mockResolvedValue(
        correo({
          asunto: '',
          de: '',
          para: '',
          fecha: null,
          texto: '',
          html: '',
          adjuntos: [],
        }),
      );

      await servicio.ingresar(MSG, ctx);
      await esperarSegundoPlano();

      expect(pedidoIa.ingestarPedido).not.toHaveBeenCalled();
      expect(ingresos.marcarError).toHaveBeenCalledTimes(1);
    });

    it('usa el HTML sin etiquetas cuando el correo no trae texto plano', async () => {
      const { servicio, n8n, ingresos, pedidoIa } = montar();
      ingresos.reservar.mockResolvedValue({ reservada: true, fila: fila() });
      n8n.obtener.mockResolvedValue(
        correo({
          texto: '',
          html: '<p>5&nbsp;cajas</p><style>p{}</style>',
          adjuntos: [],
        }),
      );
      pedidoIa.ingestarPedido.mockResolvedValue({
        idOrdenVenta: 'ov',
        codigo: 'OV-1',
      });

      await servicio.ingresar(MSG, ctx);
      await esperarSegundoPlano();

      const { texto } = pedidoIa.ingestarPedido.mock.calls[0][0] as {
        texto: string;
      };
      expect(texto).toContain('5 cajas');
      expect(texto).not.toContain('<p>');
      expect(texto).not.toContain('p{}');
    });

    it.each(['', 'a b', '../x', 'ab', 'x'.repeat(80)])(
      'rechaza el identificador inválido %j antes de reservar',
      async (id) => {
        const { servicio, ingresos } = montar();
        await expect(servicio.ingresar(id, ctx)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(ingresos.reservar).not.toHaveBeenCalled();
      },
    );

    it('rechaza una cuenta no habilitada antes de reservar', async () => {
      const { servicio, ingresos } = montar('OTRA');
      await expect(servicio.ingresar(MSG, ctx)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(ingresos.reservar).not.toHaveBeenCalled();
    });
  });

  describe('consultar', () => {
    it('devuelve el estado del ingreso', async () => {
      const { servicio, ingresos } = montar();
      ingresos.buscar.mockResolvedValue(
        fila({ estado: 'ingresado', codigoOrdenVenta: 'OV-9' }),
      );
      const resultado = await servicio.consultar(MSG, ctx);
      expect(resultado).toMatchObject({
        estado: 'ingresado',
        codigoOrdenVenta: 'OV-9',
      });
      expect(ingresos.buscar).toHaveBeenCalledWith('emp_demo', '023WA', MSG);
    });

    it('responde 404 si nunca se intentó ingresar', async () => {
      const { servicio, ingresos } = montar();
      ingresos.buscar.mockResolvedValue(null);
      await expect(servicio.consultar(MSG, ctx)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
