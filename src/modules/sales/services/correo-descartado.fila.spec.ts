import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { RolNivel, WmsRol } from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { CorreosQueryDto } from '../dto/correos-query.dto';
import type {
  CorreoIngresoFila,
  CorreoIngresoRepository,
} from '../infrastructure/correo-ingreso.repository';
import type { N8nCorreosClient } from '../infrastructure/n8n-correos.client';
import { CorreoDescartadoService } from './correo-descartado.service';
import type { PedidoIaService } from './pedido-ia.service';

const MSG = 'abc123def';

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

const ingreso = (
  parcial: Partial<CorreoIngresoFila> = {},
): CorreoIngresoFila => ({
  idCorreoIngreso: 'c1',
  messageId: MSG,
  estado: 'procesando',
  idOrdenVenta: null,
  codigoOrdenVenta: null,
  error: null,
  ...parcial,
});

const filaDescartada = {
  messageId: MSG,
  nuevoPedido: false,
  resultado: 'no_es_pedido',
  codigoOrdenVenta: null,
};

function montar(cuentas = '023WA') {
  const n8n = { obtener: jest.fn() };
  const ingresos = {
    reservar: jest.fn(),
    buscar: jest.fn(),
    buscarEntrada: jest.fn(),
    ingresoDeEntrada: jest.fn(),
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

describe('CorreoDescartadoService.obtener (REQ-318)', () => {
  it('devuelve la fila descartada sin ingreso', async () => {
    const { servicio, ingresos } = montar();
    ingresos.buscarEntrada.mockResolvedValue(filaDescartada);
    ingresos.ingresoDeEntrada.mockResolvedValue(undefined);

    const resultado = await servicio.obtener(MSG, ctx);

    expect(resultado).toMatchObject({
      messageId: MSG,
      ingreso: null,
      codigoOrdenVenta: null,
    });
    expect(ingresos.ingresoDeEntrada).toHaveBeenCalledWith(
      'emp_demo',
      '023WA',
      MSG,
    );
  });

  it('completa codigoOrdenVenta con el ingreso ingresado', async () => {
    const { servicio, ingresos } = montar();
    ingresos.buscarEntrada.mockResolvedValue(filaDescartada);
    ingresos.ingresoDeEntrada.mockResolvedValue(
      ingreso({
        estado: 'ingresado',
        codigoOrdenVenta: 'OV-00000123',
        idOrdenVenta: '7',
        error: null,
      }),
    );

    const resultado = await servicio.obtener(MSG, ctx);

    expect(resultado.ingreso?.estado).toBe('ingresado');
    expect(resultado.codigoOrdenVenta).toBe('OV-00000123');
  });

  it('sin fila lanza CORREO_NO_ENCONTRADO y no lista ingresos', async () => {
    const { servicio, ingresos } = montar();
    ingresos.buscarEntrada.mockResolvedValue(null);

    await expect(servicio.obtener(MSG, ctx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(servicio.obtener(MSG, ctx)).rejects.toMatchObject({
      response: { error: 'CORREO_NO_ENCONTRADO' },
    });
    expect(ingresos.ingresoDeEntrada).not.toHaveBeenCalled();
  });

  it('messageId inválido responde BadRequest sin consultar', async () => {
    const { servicio, ingresos } = montar();

    await expect(servicio.obtener('ab', ctx)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ingresos.buscarEntrada).not.toHaveBeenCalled();
    expect(ingresos.ingresoDeEntrada).not.toHaveBeenCalled();
  });

  it('cuenta no habilitada responde 403 CORREOS_NO_DISPONIBLES', async () => {
    const { servicio, ingresos } = montar('OTRA');

    await expect(servicio.obtener(MSG, ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(servicio.obtener(MSG, ctx)).rejects.toMatchObject({
      response: { error: 'CORREOS_NO_DISPONIBLES' },
    });
    expect(ingresos.buscarEntrada).not.toHaveBeenCalled();
  });

  it('listar sigue devolviendo codigoOrdenVenta del ingreso cuando la fila no trae', async () => {
    const { servicio, ingresos } = montar();
    ingresos.listarEntradas.mockResolvedValue({
      total: 1,
      filas: [{ messageId: MSG, codigoOrdenVenta: null }],
    });
    ingresos.listarPorMessageIds.mockResolvedValue([
      ingreso({ estado: 'ingresado', codigoOrdenVenta: 'OV-00000123' }),
    ]);

    const resultado = await servicio.listar(query, ctx);

    expect(resultado.filas[0].codigoOrdenVenta).toBe('OV-00000123');
    expect(resultado.filas[0].ingreso).toMatchObject({
      estado: 'ingresado',
      codigoOrdenVenta: 'OV-00000123',
    });
  });

  it('si ingresoDeEntrada falla con 503, obtener rechaza con esa excepción', async () => {
    const { servicio, ingresos } = montar();
    ingresos.buscarEntrada.mockResolvedValue(filaDescartada);
    const fallo = new ServiceUnavailableException({
      error: 'CORREOS_LECTURA_FALLIDA',
      message:
        'No se pudo leer la lista de correos. Intenta de nuevo en unos minutos.',
    });
    ingresos.ingresoDeEntrada.mockRejectedValue(fallo);

    await expect(servicio.obtener(MSG, ctx)).rejects.toBe(fallo);
  });
});
