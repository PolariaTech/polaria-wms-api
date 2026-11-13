import type { ArchivoExtraido, ArchivoTexto } from "./file-extractors";
import { calcularCantidadDesdeCajas } from "./utils/empaque-lineas";
import { extractEntregaDesdeTexto } from "./utils/extract-entrega-desde-texto";
import { resolverFechaEntrega } from "./utils/clasificar-adjunto-oc-mensual";
import { aplicarIdPedidoAplicativo, resolveDireccionEntregaDesdeTexto } from "./utils/direccion-correo-aplicativo";
import { resolveCentroConsumoSinConfundirConCliente } from "./utils/centro-consumo-vs-cliente";
import { enrichAlmacenConCodigoDesdeTexto, enrichLineasAlmacenConCodigoDesdeTexto } from "./utils/enrich-almacen-codigo";
import { normalizeNumeroPedidoFields } from "./utils/normalize-numero-pedido";
import { sanitizeTelefonoContacto } from "./utils/sanitize-telefono-contacto";
import { extractCorreoContactoDesdeTexto } from "./utils/correo-chrome";
import { armarOrigenCorreoDesdeLineas } from "./utils/origen-correo-renglones";
import type {
  LineaExtraida,
  PedidoExtraido,
  PedidoExtraidoRaw,
} from "./openai-pedido.tipos";

/** Valida/coacciona la clave de Mateo contra el catálogo real. */
function coerceProductoCatalogo(
  value: string | null | undefined,
  catalogoClaves: readonly string[],
): string | null {
  if (!value?.trim() || catalogoClaves.length === 0) return null;
  const raw = value.trim();
  if (catalogoClaves.includes(raw)) return raw;

  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\s+/g, " ");

  const rawNorm = normalize(raw);
  const byNorm = catalogoClaves.find((k) => normalize(k) === rawNorm);
  if (byNorm) return byNorm;

  const codigoMatch = raw.match(/\(([^()]+)\)\s*$/);
  const codigo = codigoMatch?.[1]?.trim().toLowerCase();
  if (codigo) {
    const hits = catalogoClaves.filter((k) => {
      const m = k.match(/\(([^()]+)\)\s*$/);
      return m?.[1]?.trim().toLowerCase() === codigo;
    });
    if (hits.length === 1) return hits[0] ?? null;
  }

  return null;
}

export function postprocesarPedido(params: {
  raw: string;
  texto: string;
  archivosExtraidos: ArchivoExtraido[];
  archivosTexto: ArchivoTexto[];
  hoyISO: string;
  catalogoClaves: string[];
  archivosNoLegibles: string[];
}): PedidoExtraido {
  const {
    raw,
    texto,
    archivosExtraidos,
    archivosTexto,
    hoyISO,
    catalogoClaves,
    archivosNoLegibles,
  } = params;
  const parsed = JSON.parse(raw) as PedidoExtraidoRaw;

  const lineasRaw: LineaExtraida[] = parsed.lineas.map((l) => ({
    textoOriginal: l.textoOriginal,
    productoCatalogo: coerceProductoCatalogo(l.productoCatalogo, catalogoClaves),
    // El cálculo determinista manda siempre que sea posible (cajas + presentación con
    // peso parseable); el número que haya dado la IA solo se usa cuando no hay nada
    // que calcular — así el resultado no depende de si el modelo decidió o no hacer
    // la multiplicación por su cuenta.
    cantidad: calcularCantidadDesdeCajas(l.cajas, l.presentacion) ?? l.cantidad,
    unidad: l.unidad,
    cajas: l.cajas,
    presentacion: l.presentacion,
    especificacion: l.especificacion,
    numeroPedido: l.numeroPedido?.trim() || null,
    almacen: l.almacen?.trim() || null,
    numeroAlmacen: l.numeroAlmacen?.trim() || null,
    referenciaPedido: l.referenciaPedido?.trim() || null,
    codigoProductoCliente: l.codigoProductoCliente?.trim() || null,
    responsableExterno: l.responsableExterno?.trim() || null,
    precioUnitario:
      l.precioUnitario != null &&
      Number.isFinite(l.precioUnitario) &&
      l.precioUnitario > 0
        ? l.precioUnitario
        : null,
  }));

  // Post-proceso determinista: Oc Generada vs columna Usuario (Xcaret y similares).
  const sourceForOc = [
    texto,
    ...archivosTexto.map((f) => `--- ${f.nombre} ---\n${f.contenido}`),
  ].join("\n");
  const fileNames = archivosExtraidos.map((f) => f.nombre);
  const normalizedPedidos = aplicarIdPedidoAplicativo(normalizeNumeroPedidoFields({
    ordenCompraHotel: parsed.ordenCompraHotel?.trim() || null,
    lineas: lineasRaw,
    sourceText: sourceForOc,
    fileNames,
  }), sourceForOc);
  const sourceForEntrega = sourceForOc;
  const lineas = enrichLineasAlmacenConCodigoDesdeTexto(
    normalizedPedidos.lineas,
    sourceForEntrega,
  );
  const ordenCompraHotelNormalizado = normalizedPedidos.ordenCompraHotel;

  // Fallback determinista: si Mateo dejó fecha/hora null, leerlas del cuerpo/PDF.
  const entregaBody = extractEntregaDesdeTexto(sourceForEntrega, hoyISO);
  const fechaDesdeIa = resolverFechaEntrega(parsed.fechaEntregaTexto, hoyISO);
  // REQ-119: línea Entrega:/Delivery date del cuerpo manda sobre Mateo (evita Enviado/hoy).
  const fechaBody =
    entregaBody.fechaIso ||
    resolverFechaEntrega(entregaBody.fechaFrase, hoyISO);
  const fechaEntrega = fechaBody || fechaDesdeIa;
  const horarioDesde =
    parsed.horarioDesde?.trim() || entregaBody.horarioDesde || null;
  const horarioHasta =
    parsed.horarioHasta?.trim() || entregaBody.horarioHasta || null;

  const fechaLabel =
    parsed.fechaEntregaTexto?.trim() ||
    entregaBody.fechaFrase ||
    fechaEntrega ||
    null;
  const nombreClienteCabecera =
    (typeof parsed.nombreCliente === "string"
      ? parsed.nombreCliente.trim()
      : "") || "";
  // Ship To del documento manda sobre Bill To / lo que Mateo haya puesto.
  // REQ-231: en el correo del aplicativo la línea «Dirección:» manda sobre cualquier Ship To.
  const direccionCabecera =
    resolveDireccionEntregaDesdeTexto(sourceForEntrega) ||
    parsed.direccion?.trim() ||
    "";
  const andenCabecera = parsed.anden?.trim() || "";
  const contactoCabecera = parsed.contacto?.trim() || "";
  const telefonoCabecera = sanitizeTelefonoContacto(parsed.telefono);
  // REQ-122: no usar From genérico (bss_system / noreply / proveedor).
  const correoCabecera =
    extractCorreoContactoDesdeTexto(sourceForEntrega) || "";
  const ventanaDesdeCabecera = horarioDesde || "";
  const ventanaHastaCabecera = horarioHasta || "";
  const notasCabecera = parsed.observaciones?.trim() || "";
  const origenCorreo = armarOrigenCorreoDesdeLineas(lineas, {
    // ISO primero: al reabrir OV, parseFechaOrigen no debe romper MM/DD BirchStreet.
    fecha: fechaEntrega || fechaLabel || "",
    centroConsumo: parsed.centroConsumo || "",
    ordenCompra: ordenCompraHotelNormalizado || "",
    nombreCliente: nombreClienteCabecera,
    contacto: contactoCabecera,
    ventanaDesde: ventanaDesdeCabecera,
    ventanaHasta: ventanaHastaCabecera,
    direccion: direccionCabecera,
    anden: andenCabecera,
    telefono: telefonoCabecera,
    correo: correoCabecera,
    notas: notasCabecera,
  });

  const nombreCliente = parsed.nombreCliente?.trim() || null;
  const centroDesdeLineas =
    lineas.find((l) => l.almacen?.trim())?.almacen?.trim() || null;
  const pedido: PedidoExtraido = {
    fechaEntrega,
    centroConsumo: resolveCentroConsumoSinConfundirConCliente(
      enrichAlmacenConCodigoDesdeTexto(
        parsed.centroConsumo || centroDesdeLineas,
        sourceForEntrega,
      ),
      nombreCliente,
    ),
    observaciones: parsed.observaciones,
    ordenCompraHotel: ordenCompraHotelNormalizado,
    nombreCliente,
    rfc: parsed.rfc,
    regimen: parsed.regimen,
    direccion: direccionCabecera || null,
    anden: parsed.anden,
    contacto: parsed.contacto,
    telefono: telefonoCabecera || null,
    horarioDesde,
    horarioHasta,
    tolerancia: parsed.tolerancia,
    sustituciones: parsed.sustituciones,
    lote: parsed.lote,
    temperatura: parsed.temperatura,
    lineas,
    origenCorreo,
    advertencia: parsed.advertencia,
    archivosNoLegibles,
  };

  return pedido;
}
