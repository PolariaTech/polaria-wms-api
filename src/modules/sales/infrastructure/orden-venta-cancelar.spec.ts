import { cancelarOvSideEffects } from './orden-venta-cancelar';

describe('cancelarOvSideEffects (REQ-350)', () => {
  it('libera reserva y cancela OT/tareas pendientes', async () => {
    const sql: string[] = [];
    const tx = {
      $queryRawUnsafe: jest.fn(async () => []),
      $executeRawUnsafe: jest.fn(async (q: string) => {
        sql.push(q);
        return 0;
      }),
    };

    await cancelarOvSideEffects(
      tx as never,
      'public',
      {
        idOrdenVenta: '11111111-1111-1111-1111-111111111111',
        codigoCuenta: 'CUENTA',
        idBodega: '22222222-2222-2222-2222-222222222222',
      },
      '33333333-3333-3333-3333-333333333333',
    );

    expect(sql.some((q) => q.includes('orden_trabajo'))).toBe(true);
    expect(sql.some((q) => q.includes('tarea_cola'))).toBe(true);
    expect(tx.$queryRawUnsafe).toHaveBeenCalled();
  });
});
