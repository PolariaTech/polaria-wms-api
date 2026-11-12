/**
 * REQ-288 / REQ-290 / REQ-287 / REQ-309: reglas del prompt de lectura que evitan los tres fallos reportados de
 * Mateo: leer dos veces el mismo pedido (mensaje y archivo), cambiar un producto por otro
 * parecido y perder lo que el cliente especificó. Van aparte para no crecer el cliente.
 */
export const REGLAS_LECTURA_PEDIDO: readonly string[] = [
  `- Matching producto (REQ-115): NUNCA asignes productoCatalogo de otra familia (cebolla ≠ aguacate). Si hay duda → null.`,
  `- Mensaje y archivos (REQ-288): el vendedor suele pegar el pedido en el mensaje Y adjuntar el documento con lo mismo. Extrae cada producto UNA sola vez: si un renglón del mensaje ya está en el archivo con la misma cantidad y destino, no lo repitas. Dos filas son distintas solo si cambia el producto, la cantidad, la presentación o el destino (almacén / PO). Recorre TODOS los renglones: si un producto aparece solo en una de las dos fuentes, también va.`,
  `- Producto parecido no es el mismo (REQ-290): no basta con que compartan una palabra. "Pimiento morrón rojo" NO es "Pulpa de frutos rojos"; verdura o fruta fresca NO es pulpa, jugo, congelado ni puré. Si el único candidato es de otra forma de presentación del producto → productoCatalogo null.`,
  `- Unidad y especificaciones del documento (REQ-290): conserva la unidad que dice el documento (piezas, cajas, kilos, litros) y no la cambies por la del catálogo; "caja de 10 jugos" son piezas/cajas, no litros. Todo lo que el cliente pide sobre el producto ("sin pecacho", "en bote", "sin cáscara", madurez, corte, tamaño) va completo en "especificacion"; nunca lo descartes.`,
  `- Código del cliente (REQ-299): "codigoProductoCliente" es SOLO el código escrito en ESE renglón del documento. Nunca copies ahí un SKU del catálogo ni los SKU de las reglas (p. ej. los de AGUACATE) para otro producto. Si el renglón no trae código → null.`,
  `- Código y descripción (REQ-309): si el documento trae una columna de código o nombre corto (Código de Artículo, SKU, Clave) y otra de descripción, "textoOriginal" es la descripción COMPLETA del renglón tal como está escrita (producto, variedad y presentación, p. ej. "Tomate saladet bola por kilo"), nunca solo el nombre corto de la columna de código. Ese código corto va en "codigoProductoCliente".`,
  `- Especificación completa (REQ-287): todo lo que el renglón dice y no es el nombre del producto (sin penacho, limpio, sin cáscara, en bote, fresco, envase, domo, madurez) va completo en "especificacion", aunque ya esté dentro de "textoOriginal". No dejes "especificacion" en null si el renglón trae alguna de esas indicaciones.`,
];
