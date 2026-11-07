import { Logger, UnprocessableEntityException } from '@nestjs/common';
import {
  EstadoOrdenVenta,
  RolNivel,
  WmsRol,
} from '../../../generated/prisma/client';
import type { TenantContext } from '../../../core/tenant/tenant-context.interface';
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

function cuerpo(
  instruccion: string,
  fechas: [string, string] = ['2026-11-07', '2026-11-08'],
): PropuestaReagrupacionBodyDto {
  const ot = (n: number, oc: string, fecha: string, producto: string) => ({
    otId: `ot-${n}`,
    etiqueta: `${oc} — COCINA`,
    almacen: 'COCINA',
    numeroPedido: oc,
    fecha,
    horario: '06:00 - 08:00',
    renglones: [{ renglonId: `l-${n}`, producto, cantidad: 10 }],
  });
  return {
    requestId: '770e8400-e29b-41d4-a716-446655440002',
    instruccion,
    estadoBase: {
      ots: [
        ot(1, '4502988065', fechas[0], 'Aguacate'),
        ot(2, '4502988746', fechas[1], 'Limón'),
      ],
    },
  };
}

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
      llm,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('REQ-262: dos pedidos, uno por OC, devuelve la división sin mover tareas', async () => {
    llm.proponer.mockResolvedValue(
      respuestaModelo({
        resultado: 'division',
        ots: [],
        criterio: 'oc',
        valoresSalen: ['4502988746'],
      }),
    );

    const res = await service.proponer(ID_OV, cuerpo('Una OV por cada orden de compra'), ctx);

    expect(res.division).toEqual({
      criterio: 'oc',
      valoresSalen: ['4502988746'],
      valoresQuedan: ['4502988065'],
      otIdsQueSalen: ['ot-2'],
    });
    expect(res.propuestaId).toBeDefined();
    expect(res.baseHash).toBeDefined();
    expect(res.ots).toBeUndefined();
    expect(res.aclaracion).toBeUndefined();
  });

  it('divide por día de entrega cuando el operador lo pide', async () => {
    llm.proponer.mockResolvedValue(
      respuestaModelo({
        resultado: 'division',
        ots: [],
        criterio: 'dia',
        valoresSalen: ['2026-11-08'],
      }),
    );

    const res = await service.proponer(ID_OV, cuerpo('Sepáralas por día de entrega'), ctx);

    expect(res.division).toMatchObject({
      criterio: 'dia',
      valoresSalen: ['2026-11-08'],
      valoresQuedan: ['2026-11-07'],
    });
  });

  it('el modelo recibe el día y el horario de cada tarea', async () => {
    llm.proponer.mockResolvedValue(respuestaModelo({ resultado: 'rechazo', ots: [] }));

    await service.proponer(ID_OV, cuerpo('Sepáralas por día'), ctx);

    const { contexto } = llm.proponer.mock.calls[0][0] as {
      contexto: { ots: Array<{ fecha: string; horario: string }> };
    };
    expect(contexto.ots.map((o) => o.fecha)).toEqual(['2026-11-07', '2026-11-08']);
    expect(contexto.ots[0].horario).toBe('06:00 - 08:00');
  });

  it('si todas las tareas tienen el mismo día explica por qué no se puede dividir por día', async () => {
    llm.proponer.mockResolvedValue(
      respuestaModelo({ resultado: 'division', ots: [], criterio: 'dia', valoresSalen: [] }),
    );

    const res = await service.proponer(
      ID_OV,
      cuerpo('Sepáralas por día', ['2026-11-07', '2026-11-07']),
      ctx,
    );

    expect(res.aclaracion).toBe(
      'No puedo dividir la orden: todas sus tareas tienen el mismo día de entrega, o no lo tienen registrado.',
    );
    expect(res.division).toBeUndefined();
    expect(llm.proponer).toHaveBeenCalledTimes(1);
  });

  it('si pide otra OV por un motivo que no es OC, día u horario, lo dice con un texto fijo', async () => {
    llm.proponer.mockResolvedValue(
      respuestaModelo({ resultado: 'division', ots: [], criterio: 'otro', valoresSalen: [] }),
    );

    const res = await service.proponer(
      ID_OV,
      cuerpo('Quiero sacar el aguacate y crearlo como OV nueva'),
      ctx,
    );

    expect(res.aclaracion).toContain('por orden de compra, por día de entrega o por horario');
    expect(res.aclaracion).toContain('Para sacar un producto suelto');
  });

  it('una división con un valor inventado se trata como salida inválida', async () => {
    llm.proponer.mockResolvedValue(
      respuestaModelo({ resultado: 'division', ots: [], criterio: 'oc', valoresSalen: ['0000'] }),
    );

    await expect(service.proponer(ID_OV, cuerpo('Una OV por OC'), ctx)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(llm.proponer).toHaveBeenCalledTimes(2);
  });
});
