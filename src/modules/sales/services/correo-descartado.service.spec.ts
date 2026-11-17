import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { CorreosQueryDto } from '../dto/correos-query.dto';
import type {
  CorreoIngresoFila,
  CorreoIngresoRepository,
} from '../infrastructure/correo-ingreso.repository';
import type { GmailCorreosClient } from '../infrastructure/gmail-correos.client';
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

function montar(cuentas = '023WA') {
  const gmail = {
    obtener: jest.fn(),
    descargarAdjunto: jest.fn().mockResolvedValue({
      nombre: 'pedido.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('PDF'),
    }),
  };
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
    gmail as unknown as GmailCorreosClient,
    ingresos as unknown as CorreoIngresoRepository,
    pedidoIa as unknown as PedidoIaService,
    config as unknown as ConfigService,
  );
  return { servicio, gmail, ingresos, pedidoIa };
}

describe('CorreoDescartadoService (REQ-104)', () => {
  describe('listar', () => {
    it('cruza cada correo con su estado de ingreso en el WMS', async () => {
      const { servicio, gmail, ingresos } = montar();
      ingresos.listarEntradas.mockResolvedValue({
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

      // lee de Supabase, de la cuenta del usuario, y no llama al Puente de gmail (CA3)
      expect(ingresos.listarEntradas).toHaveBeenCalledWith(
        'emp_demo',
        '023WA',
        query,
      );
      expect(gmail.obtener).not.toHaveBeenCalled();
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
      const { servicio, ingresos } = montar('1YW43');
      await expect(servicio.listar(query, ctx)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(ingresos.listarEntradas).not.toHaveBeenCalled();
    });

    it('rechaza si no hay cuentas configuradas', async () => {
      const { servicio, ingresos } = montar('');
      await expect(servicio.listar(query, ctx)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(ingresos.listarEntradas).not.toHaveBeenCalled();
    });
  });
});
