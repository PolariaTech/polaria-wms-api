import { armarFiltroEntradas } from './correo-entrada.consultas';

const FILTRO = { modo: 'todos' as const, pagina: 1, tamano: 25 };
const TABLA_INGRESOS = '"emp_demo".correo_pedido_ingreso';

describe('armarFiltroEntradas (POL-410)', () => {
  it('siempre filtra por cuenta y no interpola el texto del usuario', () => {
    const { donde, params } = armarFiltroEntradas(
      '023WA',
      {
        ...FILTRO,
        remitente: 'hotel%',
        asunto: 'pedido',
      },
      TABLA_INGRESOS,
    );
    expect(donde).toContain('codigo_cuenta = $1');
    expect(donde).not.toContain('hotel');
    expect(params[0]).toBe('023WA');
    expect(params).toContain('%hotel\\%%');
  });

  it('el modo descartados solo trae los que el workflow descartó', () => {
    const { donde } = armarFiltroEntradas(
      '023WA',
      {
        ...FILTRO,
        modo: 'descartados',
      },
      TABLA_INGRESOS,
    );
    expect(donde).toContain('nuevo_pedido = false');
  });

  it('descartados excluye los ya ingresados a mano', () => {
    const { donde, params } = armarFiltroEntradas(
      '023WA',
      { ...FILTRO, modo: 'descartados' },
      TABLA_INGRESOS,
    );
    expect(donde).toContain('nuevo_pedido = false');
    expect(donde).toContain(
      'NOT EXISTS (SELECT 1 FROM "emp_demo".correo_pedido_ingreso i',
    );
    expect(donde).toContain('i.codigo_cuenta = $1');
    expect(donde).toContain('i.message_id = e.message_id');
    expect(donde).toContain("i.estado = 'ingresado'");
    expect(params).toEqual(['023WA']);
  });

  it('procesados trae los del workflow y los ingresados a mano', () => {
    const { donde, params } = armarFiltroEntradas(
      '023WA',
      { ...FILTRO, modo: 'procesados' },
      TABLA_INGRESOS,
    );
    expect(donde).toContain(
      'nuevo_pedido IS DISTINCT FROM false OR EXISTS (SELECT 1 FROM "emp_demo".correo_pedido_ingreso i',
    );
    expect(donde).not.toContain('nuevo_pedido = false');
    expect(params).toEqual(['023WA']);
  });

  it('todos no filtra por ingreso ni por nuevo_pedido', () => {
    const { donde, params } = armarFiltroEntradas(
      '023WA',
      FILTRO,
      TABLA_INGRESOS,
    );
    expect(donde).not.toContain('correo_pedido_ingreso');
    expect(donde).not.toContain('nuevo_pedido');
    expect(params).toEqual(['023WA']);
  });
});
