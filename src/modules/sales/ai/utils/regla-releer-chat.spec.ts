import { pideReleerDocumentos } from './regla-releer-chat';

describe('pideReleerDocumentos (POL-413)', () => {
  it.each([
    'vuelve a leer el correo, el total debe ser 27905.25',
    'relee los archivos: faltan ot de la orden de compra oc-200',
    'divide por orden de compra y verifica contra el correo',
    'el total no coincide con la factura',
    'cuadra con el pdf',
  ])('pide releer: %s', (texto) => {
    expect(pideReleerDocumentos(texto)).toBe(true);
  });

  it.each([
    'divide la orden de venta por orden de compra: la orden de compra oc-200 pasa a una orden de venta nueva',
    'separa las órdenes de compra en órdenes de venta distintas',
    'reparte por oc: la po 4500 sale a otra orden de venta',
  ])('repartir por orden de compra lo que ya existe NO es releer: %s', (texto) => {
    expect(pideReleerDocumentos(texto)).toBe(false);
  });

  it.each([
    'junta comedor y bares',
    'saca el aguacate de esta ot a una nueva',
    '',
  ])('sin palabras de documentos no pide releer: %p', (texto) => {
    expect(pideReleerDocumentos(texto)).toBe(false);
  });
});
