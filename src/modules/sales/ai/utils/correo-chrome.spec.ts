import { parseCorreoChromeFromText } from './correo-chrome';

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
