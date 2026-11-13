import type { LineaExtraida } from '../openai-pedido.tipos';
import type { OrigenCorreoRenglon } from './origen-correo-ordenes-trabajo';

/**
 * REQ-287: renglón de origen_correo con la especificación que el modelo leyó del documento
 * (sin penacho, limpio, en bote…). La web la usa al materializar la OV, antes de inferirla.
 */
export type OrigenCorreoRenglonConEspecificacion = OrigenCorreoRenglon & {
  Especificacion?: string;
};

/** Datos de la cabecera del pedido que se repiten en cada renglón. */
export interface CabeceraOrigenCorreo {
  fecha: string;
  centroConsumo: string;
  ordenCompra: string;
  nombreCliente: string;
  contacto: string;
  ventanaDesde: string;
  ventanaHasta: string;
  direccion: string;
  anden: string;
  telefono: string;
  correo: string;
  notas: string;
}

/** Especificación del renglón, en una sola línea y sin espacios de más. */
export function especificacionDeLinea(
  linea: Pick<LineaExtraida, 'especificacion'>,
): string {
  return (linea.especificacion ?? '').replace(/\s+/g, ' ').trim();
}

/** Arma los renglones de origen_correo a partir de las líneas leídas. */
export function armarOrigenCorreoDesdeLineas(
  lineas: readonly LineaExtraida[],
  cab: CabeceraOrigenCorreo,
): OrigenCorreoRenglonConEspecificacion[] {
  return lineas.map((l, index) => {
    const especificacion = especificacionDeLinea(l);
    return {
      Fecha: cab.fecha,
      Unidad: l.unidad === 'KGM' ? 'KGS' : l.unidad || '',
      Almacen: l.almacen || cab.centroConsumo,
      Horario: '',
      Cantidad: l.cantidad ?? 0,
      Producto: l.textoOriginal || l.productoCatalogo || '',
      Precio:
        l.precioUnitario != null &&
        Number.isFinite(l.precioUnitario) &&
        l.precioUnitario > 0
          ? l.precioUnitario
          : '',
      'Numero correo': '',
      'Numero pedido': l.numeroPedido || cab.ordenCompra,
      'Nombre cliente': cab.nombreCliente,
      'Numero almacen': l.numeroAlmacen || '',
      'Codigo producto': l.codigoProductoCliente || '',
      'Referencia pedido': l.referenciaPedido || '',
      'Responsable externo': l.responsableExterno || cab.contacto,
      'Responsable interno': '',
      'Referencia del cliente': '',
      'Ventana desde': cab.ventanaDesde,
      'Ventana hasta': cab.ventanaHasta,
      Destino: cab.direccion,
      'Direccion entrega': cab.direccion,
      Anden: cab.anden,
      'Telefono contacto': cab.telefono,
      'Correo contacto': cab.correo,
      Prioridad: '',
      'Notas generales': cab.notas,
      ...(especificacion ? { Especificacion: especificacion } : {}),
      _lineaIndex: index,
    };
  });
}
