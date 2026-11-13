import {
  extractCorreoContactoDesdeTexto,
  isCorreoRemitenteGenerico,
  parseCorreoChromeFromText,
} from './correo-chrome';

describe('parseCorreoChromeFromText — cabeceras partidas en varias líneas (REQ-258)', () => {
  it('quita del cuerpo la continuación de un Cc partido en dos líneas', () => {
    const raw = [
      'De: <cocina@cliente.example>',
      'Cc: <gerencia@empresa.example>, <',
      'operaciones@empresa.example>, Almacen <almacen@empresa.example>',
      '',
      'Aguacate  hass  9 kilos',
    ].join('\n');

    const { body } = parseCorreoChromeFromText(raw);

    expect(body).toBe('Aguacate  hass  9 kilos');
  });

  it('no borra el texto que sigue a una línea en blanco', () => {
    const raw = [
      'Subject: pedido',
      '',
      'Primera línea del pedido',
      'Segunda línea del pedido',
    ].join('\n');

    const { body } = parseCorreoChromeFromText(raw);

    expect(body).toBe('Primera línea del pedido\nSegunda línea del pedido');
  });
});

describe('extractCorreoContactoDesdeTexto — correo del proveedor (REQ-310)', () => {
  const ocBirchStreet = [
    'De: <bss_system@birchstreet.net>',
    'Para: <ventas@aguacatesdepuebla.com>',
    '',
    'PO NUMBER : CUNQR0000001 Status: Fax/email/csv accepted',
    'Supplier: Proveedor de Prueba SA de CV(Direct)',
    'Calle Falsa 123',
    'Email: facturacion@aguacatesdepuebla.com',
    'Bill To: Hotel Ejemplo CANCUN, MEXICO',
    'Ship To: Hotel Ejemplo CANCUN, MEXICO',
    'Sent From: Hotel Ejemplo CANCUN, MEXICO',
    'Calle Otra 456',
    'Email: compras@ejemplo.com',
  ].join('\n');

  it('toma el correo del comprador (Sent From), no el Email del bloque Supplier', () => {
    expect(extractCorreoContactoDesdeTexto(ocBirchStreet)).toBe('compras@ejemplo.com');
  });

  it('no devuelve un correo del proveedor aunque sea el único etiquetado', () => {
    const soloProveedor = [
      'De: <bss_system@birchstreet.net>',
      'Supplier: Proveedor de Prueba SA de CV(Direct)',
      'Email: facturacion@aguacatesdepuebla.com',
      'Bill To: Hotel Ejemplo',
    ].join('\n');
    const correo = extractCorreoContactoDesdeTexto(soloProveedor);
    expect(correo ?? '').not.toMatch(/aguacatesdepuebla/i);
  });

  it('un De: del dominio del proveedor tampoco es el contacto', () => {
    const texto = 'De: <facturacion@aguacatesdepuebla.com>\n\nPedido 5 kilos de tomate';
    expect(extractCorreoContactoDesdeTexto(texto)).toBeNull();
  });

  it('control: un De: de un comprador sigue siendo el contacto', () => {
    const texto = 'De: <cocina@ejemplo.com>\n\nPedido 5 kilos de tomate';
    expect(extractCorreoContactoDesdeTexto(texto)).toBe('cocina@ejemplo.com');
  });

  it('control: sin bloque Supplier toma el Email: etiquetado de siempre', () => {
    const texto = ['De: <bss_system@birchstreet.net>', 'Email: compras@ejemplo.com'].join('\n');
    expect(extractCorreoContactoDesdeTexto(texto)).toBe('compras@ejemplo.com');
  });

  it('isCorreoRemitenteGenerico incluye todo el dominio del proveedor', () => {
    expect(isCorreoRemitenteGenerico('facturacion@aguacatesdepuebla.com')).toBe(true);
    expect(isCorreoRemitenteGenerico('compras@ejemplo.com')).toBe(false);
  });
});
