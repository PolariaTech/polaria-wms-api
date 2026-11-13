import type { LineaExtraida } from '../openai-pedido.client';
import {
  armarOrigenCorreoDesdeLineas,
  especificacionDeLinea,
  type CabeceraOrigenCorreo,
} from './origen-correo-renglones';

const CAB: CabeceraOrigenCorreo = {
  fecha: '2026-11-06',
  centroConsumo: 'Cocina',
  ordenCompra: 'PO-1',
  nombreCliente: 'Hotel Ejemplo',
  contacto: '',
  ventanaDesde: '',
  ventanaHasta: '',
  direccion: 'Calle 1',
  anden: '',
  telefono: '',
  correo: 'compras@ejemplo.com',
  notas: '',
};

function linea(parcial: Partial<LineaExtraida>): LineaExtraida {
  return {
    textoOriginal: 'Tomate verde',
    productoCatalogo: null,
    cantidad: 3,
    unidad: 'KGM',
    cajas: null,
    presentacion: null,
    especificacion: null,
    numeroPedido: null,
    almacen: null,
    numeroAlmacen: null,
    referenciaPedido: null,
    codigoProductoCliente: '10501520',
    responsableExterno: null,
    precioUnitario: 65,
    ...parcial,
  };
}

describe('armarOrigenCorreoDesdeLineas (REQ-287)', () => {
  it('lleva la especificación leída al renglón', () => {
    const [fila] = armarOrigenCorreoDesdeLineas(
      [linea({ especificacion: '  Limpio,  sin cáscara ' })],
      CAB,
    );
    expect(fila?.Especificacion).toBe('Limpio, sin cáscara');
  });

  it('no agrega la clave cuando no hay especificación', () => {
    const [fila] = armarOrigenCorreoDesdeLineas([linea({ especificacion: '  ' })], CAB);
    expect(fila).not.toHaveProperty('Especificacion');
  });

  it('conserva los campos de siempre (cantidad, unidad, código, índice, cabecera)', () => {
    const filas = armarOrigenCorreoDesdeLineas(
      [linea({}), linea({ unidad: 'UN', cantidad: null, precioUnitario: null })],
      CAB,
    );
    expect(filas[0]).toMatchObject({
      Fecha: '2026-11-06',
      Unidad: 'KGS',
      Almacen: 'Cocina',
      Cantidad: 3,
      Producto: 'Tomate verde',
      Precio: 65,
      'Numero pedido': 'PO-1',
      'Codigo producto': '10501520',
      'Correo contacto': 'compras@ejemplo.com',
      _lineaIndex: 0,
    });
    expect(filas[1]).toMatchObject({ Unidad: 'UN', Cantidad: 0, Precio: '', _lineaIndex: 1 });
  });
});

describe('especificacionDeLinea', () => {
  it('devuelve vacío para null', () => {
    expect(especificacionDeLinea({ especificacion: null })).toBe('');
  });
});
