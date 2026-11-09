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

const query: CorreosQueryDto = { modo: 'todos', pagina: 1, tamano: 25 };

const ingreso = (parcial: Partial<CorreoIngresoFila>): CorreoIngresoFila => ({
  idCorreoIngreso: 'c1',
  messageId: 'abc123def',
  estado: 'procesando',
  idOrdenVenta: null,
  codigoOrdenVenta: null,
  error: null,
  ...parcial,
});

function montar() {
  const n8n = { obtener: jest.fn() };
  const ingresos = {
    listarEntradas: jest.fn(),
    listarPorMessageIds: jest.fn().mockResolvedValue([]),
  };
  const config = { get: jest.fn().mockReturnValue('023WA') };
  const servicio = new CorreoDescartadoService(
    n8n as unknown as N8nCorreosClient,
    ingresos as unknown as CorreoIngresoRepository,
    {} as unknown as PedidoIaService,
    config as unknown as ConfigService,
  );
  return { servicio, n8n, ingresos };
}

describe('CorreoDescartadoService: OV de cada correo (REQ-275)', () => {
  it('muestra la OV que anotó n8n y, si no hay, la del ingreso hecho a mano en el WMS', async () => {
    const { servicio, ingresos } = montar();
    ingresos.listarEntradas.mockResolvedValue({
      total: 4,
      filas: [
        { messageId: 'de-n8n-1234', codigoOrdenVenta: 'OV-00001132' },
        { messageId: 'a-mano-1234', codigoOrdenVenta: null },
        { messageId: 'procesando-12', codigoOrdenVenta: null },
        { messageId: 'sin-ov-12345', codigoOrdenVenta: null },
      ],
    });
    ingresos.listarPorMessageIds.mockResolvedValue([
      ingreso({
        messageId: 'a-mano-1234',
        estado: 'ingresado',
        codigoOrdenVenta: 'OV-00001318',
      }),
      ingreso({ messageId: 'procesando-12', estado: 'procesando' }),
      ingreso({
        messageId: 'de-n8n-1234',
        estado: 'ingresado',
        codigoOrdenVenta: 'OV-00009999',
      }),
    ]);

    const { filas } = await servicio.listar(query, ctx);

    expect(filas.map((fila) => fila.codigoOrdenVenta)).toEqual([
      'OV-00001132', // la que anotó n8n manda sobre la del WMS
      'OV-00001318',
      null,
      null,
    ]);
  });

  it('un ingreso con error no cuenta como OV', async () => {
    const { servicio, ingresos } = montar();
    ingresos.listarEntradas.mockResolvedValue({
      total: 1,
      filas: [{ messageId: 'abc123def', codigoOrdenVenta: null }],
    });
    ingresos.listarPorMessageIds.mockResolvedValue([
      ingreso({ estado: 'error', codigoOrdenVenta: 'OV-00000001' }),
    ]);

    const { filas } = await servicio.listar(query, ctx);

    expect(filas[0].codigoOrdenVenta).toBeNull();
    expect(filas[0].ingreso).toMatchObject({ estado: 'error' });
  });

  it('un correo anterior a las columnas nuevas llega con esos cuatro campos en null (CA5)', async () => {
    const { servicio, ingresos } = montar();
    ingresos.listarEntradas.mockResolvedValue({
      total: 1,
      filas: [
        {
          messageId: 'viejo-123456',
          resultado: null,
          confianza: null,
          tipo: null,
          codigoOrdenVenta: null,
        },
      ],
    });

    const { filas } = await servicio.listar(query, ctx);

    expect(filas[0]).toMatchObject({
      resultado: null,
      confianza: null,
      tipo: null,
      codigoOrdenVenta: null,
      ingreso: null,
    });
  });
});
