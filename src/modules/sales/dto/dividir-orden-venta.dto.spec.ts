import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DividirOrdenVentaBodyDto } from './dividir-orden-venta.dto';

async function errores(plano: unknown): Promise<number> {
  const dto = plainToInstance(DividirOrdenVentaBodyDto, plano);
  return (await validate(dto)).length;
}

describe('DividirOrdenVentaBodyDto', () => {
  it('acepta un criterio y una lista de valores, y recorta los espacios', async () => {
    const dto = plainToInstance(DividirOrdenVentaBodyDto, {
      criterio: 'dia',
      valoresSalen: [' 2026-11-08 '],
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.valoresSalen).toEqual(['2026-11-08']);
  });

  it('acepta los tres criterios y rechaza cualquier otro', async () => {
    for (const criterio of ['oc', 'dia', 'horario']) {
      expect(await errores({ criterio, valoresSalen: ['x'] })).toBe(0);
    }
    expect(await errores({ criterio: 'producto', valoresSalen: ['x'] })).toBeGreaterThan(0);
    expect(await errores({ valoresSalen: ['x'] })).toBeGreaterThan(0);
  });

  it('rechaza una lista vacía, textos vacíos y tipos que no son texto', async () => {
    expect(await errores({ criterio: 'oc', valoresSalen: [] })).toBeGreaterThan(0);
    expect(await errores({ criterio: 'oc', valoresSalen: ['   '] })).toBeGreaterThan(0);
    expect(await errores({ criterio: 'oc', valoresSalen: [123] })).toBeGreaterThan(0);
    expect(await errores({ criterio: 'oc' })).toBeGreaterThan(0);
  });
});
