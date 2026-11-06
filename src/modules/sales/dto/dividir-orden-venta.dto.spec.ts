import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DividirOrdenVentaBodyDto } from './dividir-orden-venta.dto';

async function errores(plano: unknown): Promise<number> {
  const dto = plainToInstance(DividirOrdenVentaBodyDto, plano);
  return (await validate(dto)).length;
}

describe('DividirOrdenVentaBodyDto', () => {
  it('acepta una lista de OC y recorta los espacios', async () => {
    const dto = plainToInstance(DividirOrdenVentaBodyDto, {
      ocSalen: [' 4502988746 '],
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.ocSalen).toEqual(['4502988746']);
  });

  it('rechaza una lista vacía, textos vacíos y tipos que no son texto', async () => {
    expect(await errores({ ocSalen: [] })).toBeGreaterThan(0);
    expect(await errores({ ocSalen: ['   '] })).toBeGreaterThan(0);
    expect(await errores({ ocSalen: [123] })).toBeGreaterThan(0);
    expect(await errores({})).toBeGreaterThan(0);
  });
});
