import { armarFiltroEntradas } from './correo-entrada.consultas';

const FILTRO = { modo: 'todos' as const, pagina: 1, tamano: 25 };

describe('armarFiltroEntradas (POL-410)', () => {
  it('siempre filtra por cuenta y no interpola el texto del usuario', () => {
    const { donde, params } = armarFiltroEntradas('023WA', {
      ...FILTRO,
      remitente: 'hotel%',
      asunto: 'pedido',
    });
    expect(donde).toContain('codigo_cuenta = $1');
    expect(donde).not.toContain('hotel');
    expect(params[0]).toBe('023WA');
    expect(params).toContain('%hotel\\%%');
  });

  it('el modo descartados solo trae los que el workflow descartó', () => {
    const { donde } = armarFiltroEntradas('023WA', {
      ...FILTRO,
      modo: 'descartados',
    });
    expect(donde).toContain('nuevo_pedido = false');
  });
});
