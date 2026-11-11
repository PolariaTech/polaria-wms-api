import {
  ERROR_INTENTO_VENCIDO,
  MENSAJE_INGRESO_VENCIDO,
  selloNumeroCorreo,
  sqlCerrarUltimoIntento,
  sqlIntentoAppendUpdate,
  sqlIntentoInicialInsert,
} from './correo-ingreso.consultas';

describe('correo-ingreso.consultas (POL-415)', () => {
  it('el intento inicial nace en procesando con n = 1', () => {
    const sql = sqlIntentoInicialInsert();
    expect(sql).toContain("'procesando'");
    expect(sql).toContain("'n', 1");
  });

  it('el reintento concatena con || y suma n', () => {
    const sql = sqlIntentoAppendUpdate();
    expect(sql).toContain("COALESCE(c.intentos, '[]'::jsonb) ||");
    expect(sql).toContain('jsonb_array_length');
  });

  it('cerrar el último intento usa jsonb_set y el resultado pedido', () => {
    const sql = sqlCerrarUltimoIntento('vencido', `'${ERROR_INTENTO_VENCIDO}'`);
    expect(sql).toContain('jsonb_set');
    expect(sql).toContain("'vencido'");
    expect(sql).toContain(ERROR_INTENTO_VENCIDO);
    expect(MENSAJE_INGRESO_VENCIDO).toContain('Reintentar');
  });

  it('el sello de OV es el objeto Numero correo', () => {
    expect(selloNumeroCorreo('abc123def')).toEqual([
      { 'Numero correo': 'abc123def' },
    ]);
  });
});
