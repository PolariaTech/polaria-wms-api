import type { ArchivoExtraido } from "./file-extractors";

export interface LineaExtraida {
  textoOriginal: string;
  productoCatalogo: string | null;
  cantidad: number | null;
  unidad: (typeof UNIDADES)[number] | null;
  cajas: number | null;
  presentacion: string | null;
  especificacion: string | null;
  /** PO / número de pedido del hotel (agrupa órdenes de trabajo). */
  numeroPedido: string | null;
  /** Centro de consumo / almacén destino del renglón. */
  almacen: string | null;
  numeroAlmacen: string | null;
  referenciaPedido: string | null;
  codigoProductoCliente: string | null;
  responsableExterno: string | null;
  /** Precio unitario del documento (columna Precio), si viene. */
  precioUnitario: number | null;
}

export interface PedidoExtraido {
  fechaEntrega: string | null;
  centroConsumo: string | null;
  observaciones: string | null;
  /** Número/código de orden de compra del hotel/cliente (PO, OC, etc.). */
  ordenCompraHotel: string | null;
  /**
   * Nombre del comprador/hotel/cliente tal como aparece en el mensaje o archivo.
   * El frontend lo cruza contra el catálogo de compradores.
   */
  nombreCliente: string | null;
  rfc: string | null;
  // Entrega (dirección, andén, contacto, teléfono, ventana): Mateo la extrae del
  // correo, mensaje o PDF. La ficha del comprador solo rellena lo que no vino.
  // Régimen, tolerancia, sustituciones, lote y temperatura siguen siendo de ficha
  // salvo que el documento los declare.
  regimen: (typeof REGIMENES)[number] | null;
  direccion: string | null;
  anden: string | null;
  contacto: string | null;
  telefono: string | null;
  horarioDesde: string | null;
  horarioHasta: string | null;
  tolerancia: (typeof TOLERANCIAS)[number] | null;
  sustituciones: (typeof SUSTITUCIONES)[number] | null;
  lote: (typeof SI_NO)[number] | null;
  temperatura: (typeof SI_NO)[number] | null;
  lineas: LineaExtraida[];
  /**
   * Renglones crudos estilo origen_correo (para agrupar hijas / persistir jsonb).
   * Se arma en el servidor a partir de las líneas extraídas.
   */
  origenCorreo: Array<
    import("./utils/origen-correo-ordenes-trabajo").OrigenCorreoRenglon & {
      Especificacion?: string;
    }
  >;
  advertencia: string | null;
  archivosNoLegibles: string[];
  /**
   * Texto a persistir en origen_texto / notas generales del PDF.
   * Cuerpo del correo (.eml) o mensaje pegado — no el dump de adjuntos.
   */
  textoOrigen?: string | null;
}

export interface ExtraerPedidoInput {
  texto: string;
  archivosExtraidos: ArchivoExtraido[];
  hoyISO: string;
  /** Claves EXACTAS del catálogo (ej. "AGUACATE EXTRA HASS (115001005)"). */
  catalogoClaves: string[];
  /** Presentaciones disponibles; puede incluir "". */
  presentaciones: string[];
}

export interface UsoOpenAI {
  tokensEntrada: number;
  tokensEntradaCacheados: number;
  tokensEntradaCacheEscritura: number;
  tokensSalida: number;
  tokensTotal: number;
  costoUSD: number | null;
}

export interface ResultadoExtraccion {
  pedido: PedidoExtraido;
  uso: UsoOpenAI | null;
}

// AUDITORÍA 2026-09-03 · Hallazgo #14 (Bajo) — "unidad" era string libre; el mismo
// escenario devolvía "KGM" en una corrida y "kilos" en otra. Vocabulario controlado.
export const UNIDADES = ["KGM", "CJ", "UN"] as const;

// Vocabulario controlado (2026-09-04) para los campos de ficha de cliente que la IA
// puede sobreescribir cuando el pedido los declara explícito — mismo <select> con
// opciones fijas que usa el formulario, para que un valor devuelto por la IA siempre
// calce con una opción real y nunca deje el campo en blanco por no coincidir exacto.
export const REGIMENES = [
  "601 — General de ley personas morales",
  "616 — Sin obligaciones fiscales",
  "612 — Personas físicas con actividad empresarial",
] as const;
export const TOLERANCIAS = ["± 2%", "± 5%", "± 10%"] as const;
export const SUSTITUCIONES = [
  "No — surtir parcial",
  "Sí, con aviso",
  "Sí, a criterio de almacén",
] as const;
export const SI_NO = ["Sí", "No"] as const;

// Modelos que ya se confirmó (en este proceso) que rechazan `temperature` personalizado
// — ver el bloque de manejo de error en extraerPedido() más abajo.
export const MODELOS_SIN_TEMPERATURA = new Set<string>();

// Lo que la IA puede decidir es SOLO interpretación de lenguaje (qué dice el texto,
// a qué producto se refiere, cuál frase es la fecha de entrega). Ninguna operación
// aritmética (sumar, multiplicar, resolver una fecha relativa a una fecha absoluta)
// se le pide a la IA — ver resolverFechaEntrega() y calcularCantidadDesdeCajas() más
// abajo, que hacen esa parte con código determinista.
export interface LineaExtraidaRaw {
  textoOriginal: string;
  productoCatalogo: string | null;
  cantidad: number | null;
  unidad: (typeof UNIDADES)[number] | null;
  cajas: number | null;
  presentacion: string | null;
  especificacion: string | null;
  numeroPedido: string | null;
  almacen: string | null;
  numeroAlmacen: string | null;
  referenciaPedido: string | null;
  codigoProductoCliente: string | null;
  responsableExterno: string | null;
  precioUnitario: number | null;
}

export interface PedidoExtraidoRaw {
  fechaEntregaTexto: string | null;
  centroConsumo: string | null;
  observaciones: string | null;
  ordenCompraHotel: string | null;
  nombreCliente: string | null;
  rfc: string | null;
  regimen: (typeof REGIMENES)[number] | null;
  direccion: string | null;
  anden: string | null;
  contacto: string | null;
  telefono: string | null;
  horarioDesde: string | null;
  horarioHasta: string | null;
  tolerancia: (typeof TOLERANCIAS)[number] | null;
  sustituciones: (typeof SUSTITUCIONES)[number] | null;
  lote: (typeof SI_NO)[number] | null;
  temperatura: (typeof SI_NO)[number] | null;
  lineas: LineaExtraidaRaw[];
  advertencia: string | null;
}
