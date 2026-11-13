import {
  correoDelBloqueEnviadoPor,
  esCorreoProveedor,
  quitarBloqueProveedor,
} from './correo-contacto-comprador';

const OC = [
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

describe('esCorreoProveedor (REQ-310)', () => {
  it('reconoce cualquier cuenta del dominio del proveedor y la cuenta de administración', () => {
    expect(esCorreoProveedor('facturacion@aguacatesdepuebla.com')).toBe(true);
    expect(esCorreoProveedor('Ventas@AguacatesDePuebla.com')).toBe(true);
    expect(esCorreoProveedor('admonaguacatesdepuebla@gmail.com')).toBe(true);
  });

  it('no marca como proveedor el correo de un comprador ni los valores vacíos', () => {
    expect(esCorreoProveedor('compras@ejemplo.com')).toBe(false);
    expect(esCorreoProveedor('')).toBe(false);
    expect(esCorreoProveedor(null)).toBe(false);
  });
});

describe('quitarBloqueProveedor (REQ-310)', () => {
  it('quita el bloque Supplier hasta Bill To y conserva el resto', () => {
    const limpio = quitarBloqueProveedor(OC);
    expect(limpio).not.toContain('aguacatesdepuebla');
    expect(limpio).not.toContain('Calle Falsa');
    expect(limpio).toContain('Bill To: Hotel Ejemplo');
    expect(limpio).toContain('compras@ejemplo.com');
  });

  it('no toca el texto sin bloque Supplier ni las frases legales con la palabra', () => {
    const texto = 'Supplier warrants that the items are free from defects.\nEmail: a@ejemplo.com';
    expect(quitarBloqueProveedor(texto)).toBe(texto);
  });
});

describe('correoDelBloqueEnviadoPor (REQ-310)', () => {
  it('devuelve el correo del bloque Sent From', () => {
    expect(correoDelBloqueEnviadoPor(OC)).toBe('compras@ejemplo.com');
  });

  it('devuelve null si no hay bloque o si solo trae correos del proveedor', () => {
    expect(correoDelBloqueEnviadoPor('Email: compras@ejemplo.com')).toBeNull();
    expect(
      correoDelBloqueEnviadoPor('Sent From: Hotel\nEmail: ventas@aguacatesdepuebla.com'),
    ).toBeNull();
  });
});
