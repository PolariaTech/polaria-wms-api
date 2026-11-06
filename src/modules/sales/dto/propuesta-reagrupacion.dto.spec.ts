import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PropuestaReagrupacionBodyDto } from './propuesta-reagrupacion.dto';

const ot = (extra: Record<string, unknown> = {}) => ({
  otId: 'ot-1',
  etiqueta: 'OC-1 — COCINA',
  almacen: 'COCINA',
  numeroPedido: 'OC-1',
  renglones: [{ renglonId: 'l-1', producto: 'Aguacate', cantidad: 10 }],
  ...extra,
});

const cuerpo = (otExtra: Record<string, unknown> = {}) => ({
  requestId: '770e8400-e29b-41d4-a716-446655440002',
  instruccion: 'Sepáralas por día de entrega',
  estadoBase: { ots: [ot(otExtra)] },
});

async function errores(plano: unknown): Promise<number> {
  return (await validate(plainToInstance(PropuestaReagrupacionBodyDto, plano)))
    .length;
}

describe('PropuestaReagrupacionBodyDto: día y horario de cada tarea (REQ-262)', () => {
  it('acepta tareas con y sin fecha ni horario', async () => {
    expect(await errores(cuerpo())).toBe(0);
    expect(
      await errores(cuerpo({ fecha: '2026-11-07', horario: '06:00 - 08:00' })),
    ).toBe(0);
  });

  it('rechaza una fecha o un horario que no es texto', async () => {
    expect(await errores(cuerpo({ fecha: 20261107 }))).toBeGreaterThan(0);
    expect(await errores(cuerpo({ horario: ['06:00'] }))).toBeGreaterThan(0);
  });

  it('rechaza un horario demasiado largo', async () => {
    expect(await errores(cuerpo({ horario: 'x'.repeat(501) }))).toBeGreaterThan(
      0,
    );
  });
});
