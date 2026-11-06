import { Logger, UnprocessableEntityException } from '@nestjs/common';
import {
  EstadoOrdenVenta,
  RolNivel,
  WmsRol,
} from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
import type { OpenAiReagrupacionClient } from '../ai/openai-reagrupacion.client';
import type { PropuestaReagrupacionBodyDto } from '../dto/propuesta-reagrupacion.dto';
import type { OrdenVentaRepository } from '../infrastructure/orden-venta.repository';
import { OrdenTrabajoReagrupacionService } from './orden-trabajo-reagrupacion.service';

const ID_OV = '550e8400-e29b-41d4-a716-446655440000';

const ctx: TenantContext = {
  idUsuario: 'user-1',
  idRol: WmsRol.operador_cuenta,
  nivelRol: RolNivel.cuenta,
  codigoEmpresa: 'EMP001',
  codigoCuenta: 'CTA001',
  codigosCuentaEmpresa: ['CTA001'],
  idBodegas: [],
  schemaName: 'emp_andino',
};

/** Dos OT, cada una de una orden de compra distinta (REQ-262). */
const body: PropuestaReagrupacionBodyDto = {
  requestId: '770e8400-e29b-41d4-a716-446655440002',
  instruccion: 'Crea dos pedidos diferentes, uno para cada orden de compra.',
  estadoBase: {
    ots: [
      {
        otId: 'ot-1',
        etiqueta: 'OC octubre',
        almacen: 'COCINA',
        numeroPedido: '4502988065',
        renglones: [{ renglonId: 'l-1', producto: 'Aguacate', cantidad: 10 }],
      },
      {
        otId: 'ot-2',
        etiqueta: 'OC noviembre',
        almacen: 'COCINA',
        numeroPedido: '4502988746',
        renglones: [{ renglonId: 'l-2', producto: 'Limón', cantidad: 8 }],
      },
    ],
  },
};

const respuestaModelo = (salida: unknown) => ({
  salida,
  modelo: 'modelo-prueba',
  tokensEntrada: 120,
  tokensSalida: 40,
});

describe('OrdenTrabajoReagrupacionService: división en otra OV', () => {
  let service: OrdenTrabajoReagrupacionService;
  let llm: { proponer: jest.Mock };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const repository = {
      findById: jest.fn().mockResolvedValue({
        idOrdenVenta: ID_OV,
        codigoCuenta: 'CTA001',
        idBodega: '660e8400-e29b-41d4-a716-446655440001',
        estado: EstadoOrdenVenta.por_confirmar,
      }),
    };
    llm = { proponer: jest.fn() };
    service = new OrdenTrabajoReagrupacionService(
      repository as unknown as OrdenVentaRepository,
      llm as unknown as OpenAiReagrupacionClient,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('REQ-262: dos pedidos, uno por OC, devuelve la división sin mover tareas', async () => {
    llm.proponer.mockResolvedValue(
      respuestaModelo({
        resultado: 'division',
        ots: [],
        ocSalen: ['4502988746'],
      }),
    );

    const res = await service.proponer(ID_OV, body, ctx);

    expect(res.division).toEqual({
      ocSalen: ['4502988746'],
      ocQuedan: ['4502988065'],
      otIdsQueSalen: ['ot-2'],
    });
    expect(res.propuestaId).toBeDefined();
    expect(res.baseHash).toBeDefined();
    expect(res.ots).toBeUndefined();
    expect(res.aclaracion).toBeUndefined();
  });

  it('una división con una OC inventada se trata como salida inválida', async () => {
    llm.proponer.mockResolvedValue(
      respuestaModelo({ resultado: 'division', ots: [], ocSalen: ['0000'] }),
    );

    await expect(service.proponer(ID_OV, body, ctx)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(llm.proponer).toHaveBeenCalledTimes(2);
  });
});
