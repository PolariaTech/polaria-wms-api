import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { ArchivoImagen, ArchivoTexto } from "./file-extractors";
import { LINEA_PROMPT_OC_MENSUAL } from "./utils/clasificar-adjunto-oc-mensual";
import { REGLAS_LECTURA_PEDIDO } from './utils/reglas-lectura-pedido';

export function buildCatalogoContext(catalogoClaves: string[]): string {
  return catalogoClaves.map((clave) => `- "${clave}"`).join("\n");
}

export function buildPresentacionesContext(presentaciones: string[]): string {
  return presentaciones
    .filter((p): p is string => Boolean(p))
    .map((p) => `- "${p}"`)
    .join("\n");
}

export function buildUserContent({
  texto,
  archivosTexto,
  archivosImagen,
}: {
  texto: string;
  archivosTexto: ArchivoTexto[];
  archivosImagen: ArchivoImagen[];
}): ChatCompletionContentPart[] {
  const partes: ChatCompletionContentPart[] = [];

  let bloqueTexto = `Mensaje del pedido (tal cual lo pegó el vendedor):\n"""\n${texto || "(sin texto)"}\n"""`;

  if (archivosTexto.length > 0) {
    bloqueTexto += "\n\nContenido extraído de archivos adjuntos:\n";
    bloqueTexto += archivosTexto
      .map((f) => `--- ${f.nombre} ---\n${f.contenido}`)
      .join("\n\n");
  }

  partes.push({ type: "text", text: bloqueTexto });

  for (const img of archivosImagen) {
    partes.push({
      type: "image_url",
      image_url: { url: `data:${img.mime};base64,${img.base64}` },
    });
  }

  return partes;
}

export function buildSystemPromptPedido(
  catalogoClaves: string[],
  presentaciones: string[],
): string {
  return [
    `Eres un asistente que lee pedidos de fruta y verdura escritos por vendedores para hoteles y extrae datos estructurados.`,
    `Catálogo de productos disponible (usa la clave EXACTA solo con coincidencia inequívoca; si hay duda o varias parecidas → null — el usuario verá sugerencias y elegirá):`,
    buildCatalogoContext(catalogoClaves),
    `Presentaciones disponibles (usa el texto EXACTO solo si el mensaje la menciona explícitamente):`,
    buildPresentacionesContext(presentaciones),
    `Reglas importantes:`,
    `- Tu trabajo es solo interpretar lenguaje: identificar qué dice el texto y a qué se refiere. NUNCA hagas cuentas (sumar, multiplicar, calcular una fecha) — eso lo hace el backend con código después de que tú extraigas los datos en crudo.`,
    `- Completa TODOS los campos del schema cuando el mensaje/archivos los mencionen de forma explícita o inequívoca (fecha, centro, orden de compra/PO, nombre del cliente/hotel, dirección, andén, contacto, teléfono, ventanas/horarios, políticas, observaciones y cada línea). No dejes null un dato que sí aparece.`,
    `- Solo extrae lo que el mensaje/archivos realmente dicen. No inventes cantidades, presentaciones, fechas, direcciones ni contactos que no estén respaldados.`,
    `- "nombreCliente" vs "centroConsumo" (crítico — no mezclar): nombreCliente = denominación comercial / razón social / hotel / propiedad / Bill To. centroConsumo = SOLO área interna (cocina, bar, banquete, almacén de fila, centro de costo). NUNCA copies el nombre del resort/hotel en centroConsumo. Si solo aparece el hotel sin cocina/área → centroConsumo null. El RFC va en "rfc", nunca en centro ni como nombre.`,
    `- "nombreCliente": denominación / hotel / comprador si aparece (Customer, Bill To, Hotel, Property, Cliente, etc.). No uses el PO ni el RFC como nombre. null solo si no hay ningún nombre.`,
    `- "nombreCliente" (REQ-116): en POs BirchStreet (bss_system@birchstreet.net) copia Property/Hotel/Bill To (ej. FAIRMONT MAYAKOBA), no el remitente ni la cocina.`,
    `- "especificacion" por línea (REQ-120): si hay columna/texto de madurez (amarillo, rojo, firme, enrriado), ponlo en lineas[].especificacion, no solo en observaciones.`,
    ...REGLAS_LECTURA_PEDIDO,
    `- Una línea por cada fila de producto del documento. Si hay VARIOS Numero pedido / PO, o el MISMO PO con DISTINTOS Almacén / centro de consumo (ej. BAWH Bar Whisky vs COPM Coc Plaza Mx, o distintos 'Centro de costo' Xcaret), emite una línea por cada producto×destino con numeroPedido y almacen de ESA fila. NO mezcles destinos ni pedidos en una sola línea. NO omitas filas de páginas intermedias.`,
    `- "numeroPedido" + "almacen" separan órdenes de trabajo: mismo PO + distinto almacén = otra hija; distinto PO = otra hija aunque el almacén coincida.`,
    `- "almacen" / "centroConsumo" (crítico — no acortar): copia SIEMPRE código + nombre completos de la columna (ej. 'ABAN Banquetes Ali', no solo 'Banquetes Ali'; 'ACOE ComedorEmplea', no solo 'Comedor…'). El código de 3–6 letras identifica la cocina del cliente; perderlo rompe el surtido. Aunque el PDF trunque visualmente la celda, conserva todo el texto legible del código y del nombre.`,
    `- NO confundas columnas: en tablas tipo Xcaret/Grupo Xcaret, 'Oc Generada' (o 'Pedido'/'OC') es el numeroPedido; 'Centro de costo' es el almacen; 'Usuario' es SOLO numeroAlmacen (o ignóralo) — NUNCA lo pongas como numeroPedido ni ordenCompraHotel. Si todas las filas comparten la misma Oc Generada, todas las líneas llevan ese mismo numeroPedido aunque el Usuario cambie.`,
    `- "precioUnitario": si el documento trae columna Precio / P.U. / Importe unitario por fila, cópialo en cada línea (número). No uses el total/importe de la fila; solo el precio unitario.`,
    `- Matching de "productoCatalogo" (crítico):`,
    `  1) Copia la clave EXACTA de la lista (mismo texto entre comillas, con paréntesis y SKU). Nunca inventes, acortes ni reformatees.`,
    `  2) Asigna clave SOLO si es inequívoca: mismo producto (nombre/sinónimo claro) Y misma variante (talla, calibre, grado, presentación, color). Ej. "chile jalapeño 6-8 cm" ≠ "chile jalapeño 8-10 cm".`,
    `  3) Si en el catálogo hay 2+ claves parecidas y el documento no distingue (ej. solo dice "aguacate hass" y hay Extra/Primera/Segunda), deja productoCatalogo en null.`,
    `  4) Si el documento trae código/SKU del cliente ("codigoProductoCliente") y ese código coincide con el SKU entre paréntesis de UNA sola clave del catálogo, usa esa clave.`,
    `  5) Si no hay coincidencia clara → null. El usuario aceptará una sugerencia, elegirá otro del catálogo o borrará la línea. Mejor null que un producto equivocado.`,
    `  6) "textoOriginal" siempre es cómo el cliente nombró el producto, aunque productoCatalogo sea null.`,
    `- "cantidad" es el número TOTAL si viene explícito y directo (ej. '40 kilos'); si el mensaje solo da cajas + presentación sin decir el total, deja "cantidad" en null.`,
    `- Envases con contenido (ej. '1 galón de 5 litros', '2 cubetas de 10 L', '3 cajas de 20 kg'): en "cantidad" pon el NÚMERO DE ENVASES (1, 2, 3), en "unidad" UN (o CJ si dice cajas), y deja el contenido en textoOriginal. NO pongas los litros/kg totales en cantidad — eso lo convierte el backend según la unidad del catálogo. "precioUnitario" es el precio POR ENVASE del documento, no por litro/kg.`,
    `- "observaciones" es del pedido completo, no repitas ahí lo que ya va en una línea. NUNCA conclusiones/inconsistencias inventadas.`,
    `- AGUACATE (catálogo): si solo dice AGUACATE / AGUACATE HASS / HASS (sin EXTRA) → AGUACATE PRIMERA (170 a 200g) SKU 115001009. Si menciona EXTRA → AGUACATE EXTRA (200 a 260g) SKU 115001005.`,
    `- "ordenCompraHotel": interpreta cuál es el identificador de la orden de compra del hotel/cliente. El nombre del campo en el documento VARÍA (PO NUMBER, PO #, Purchase Order, Orden de compra, OC, Nº OC, Oc Generada, Order No., Customer PO, REQUISICION #, R.C., Req #, etc.). Devuelve solo el código/número (ej. 4501056534, CUNMC0046026 o 50184 si dice REQUISICION # 50184). En XPU HA usa 'REQUISICION #' (ej. 50179), NUNCA el Artículo/SKU (00001678) ni el título "Requisición de Compra". NO uses 'Usuario'/User ID ni 'Autoriza'/'Autorizado'/'rAutorizado'/'Solicita'. Si el PDF se llama '4501056534_…', ese número es la OC. null solo si no hay ningún identificador de OC/PO/requisición.`,
    `- "rfc" solo si el mensaje/documento lo declara explícitamente; nunca lo infieras del nombre del cliente.`,
    `- "direccion", "anden", "contacto", "telefono", "horarioDesde" y "horarioHasta" salen del correo, mensaje o PDF (Ship To, Deliver To, Enviar a, Andén, Dock, Contacto, Tel, hora de entrega, ventana de recepción, delivery window). Llénalos siempre que el dato aparezca; null solo si no está. No inventes ni uses un valor habitual que el documento no diga.`,
    `- "horarioDesde"/"horarioHasta" (crítico): si el cuerpo dice "Hora de entrega 6:00 am", "8:00 AM – 2:00 PM", "de 8 a 14", "ventana de recepción…", DEBES llenarlos en 24h HH:MM. No los dejes null si aparecen. Una sola hora → solo horarioDesde.`,
    `- "regimen", "tolerancia", "sustituciones", "lote" y "temperatura": llénalos solo si el documento los declara. Si no aparecen, null.`,
    `- "unidad" siempre debe ser exactamente KGM, CJ o UN (o null) — nunca un texto libre como "kilos" o "kg".`,
    `- "centroConsumo" debe quedar null si el mensaje expresa incertidumbre sobre cuál es, incluso si menciona un valor tentativo de pasada. También null si lo único que hay es el nombre del hotel/denominación (eso es nombreCliente).`,
    `- "fechaEntregaTexto" (crítico): copia la frase EXACTA de ENTREGA del pedido (ej. "Entrega: viernes, 23 de octubre de 2026", "21/10/2026", "Delivery date: 10/24/2026"). NUNCA uses la fecha Enviado/Sent/Received del correo ni la del hilo. NUNCA asumas "mañana"/"hoy" si hay fecha concreta de entrega. null SOLO si de verdad no hay pista de entrega.`,
    LINEA_PROMPT_OC_MENSUAL,
    `- Si el texto y los archivos, en conjunto, NO describen un pedido de fruta/verdura (ej. son spam, un documento administrativo sin relación, contenido vacío o ilegible), deja "lineas" vacío y usa "advertencia" para explicarlo — no inventes líneas solo para llenar algo.`,
  ].join("\n");
}
