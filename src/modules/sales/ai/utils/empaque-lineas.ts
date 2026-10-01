/** Presentaciones con peso parseable (sin Granel ni vacío). */
export const PRESENTACIONES_CAJA = [
  "Caja 1.5 kg",
  "Caja 20 kg",
  "Caja 21 kg",
] as const;

export const PRESENTACION_DEFAULT_CAJAS = "Caja 1.5 kg";

export interface EmpaqueLineaState {
  cajasInput: string;
  presentacion: string;
  cantidadInput: string;
  packHint: string;
  /** Campos que el empaque rellenó automáticamente (para highlight teal). */
  autoPackFields: Array<"cajasInput" | "presentacion" | "cantidadInput">;
}

/** Extrae el número de kg de una presentación tipo "Caja 1.5 kg". */
export function pesoPorCajaKg(presentacion: string | null | undefined): number | null {
  if (!presentacion) return null;
  const m = presentacion.match(/(\d+(?:\.\d+)?)\s*kg/i);
  return m ? Number.parseFloat(m[1]) : null;
}

/** cantidad = cajas × peso por caja, redondeado a 2 decimales. */
export function calcularCantidadDesdeCajas(
  cajas: number | null,
  presentacion: string | null | undefined,
): number | null {
  const peso = pesoPorCajaKg(presentacion);
  if (cajas == null || peso == null) return null;
  return Math.round(cajas * peso * 100) / 100;
}

function parsePositive(value: string): number | null {
  const n = Number.parseFloat(value.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function hintAproximado(
  cantidad: number,
  cajas: number,
  presentacion: string,
  sobrante: number,
): string {
  const cajaLabel = presentacion.replace(/^Caja\s+/i, "");
  return (
    `Aproximado: ${cantidad} kg pedidos → ${cajas} ` +
    `${cajas === 1 ? "caja" : "cajas"} de ${cajaLabel} ` +
    `(sobran ${sobrante} kg). Confirma antes de enviar.`
  );
}

/**
 * Si hay Cajas pero no Presentación → "Caja 1.5 kg".
 * Cantidad = cajas × peso (siempre que haya cajas).
 */
export function recalcularPorCajas(input: {
  cajasInput: string;
  presentacion: string;
  cantidadInput: string;
}): EmpaqueLineaState {
  const cajas = parsePositive(input.cajasInput);
  const autoPackFields: EmpaqueLineaState["autoPackFields"] = [];
  let presentacion = input.presentacion;
  let cantidadInput = input.cantidadInput;

  if (cajas == null) {
    return {
      cajasInput: input.cajasInput,
      presentacion,
      cantidadInput,
      packHint: "",
      autoPackFields,
    };
  }

  if (!presentacion.trim()) {
    presentacion = PRESENTACION_DEFAULT_CAJAS;
    autoPackFields.push("presentacion");
  }

  const cantidad = calcularCantidadDesdeCajas(cajas, presentacion);
  if (cantidad != null) {
    cantidadInput = String(cantidad);
    autoPackFields.push("cantidadInput");
  }

  return {
    cajasInput: input.cajasInput,
    presentacion,
    cantidadInput,
    packHint: "",
    autoPackFields,
  };
}

/**
 * Sin cajas y con cantidad en kg: elige la presentación que deja menos sobrante
 * (ceil), priorizando sobrante 0 y luego menos cajas.
 */
export function sugerirEmpaqueDesdeCantidad(input: {
  cajasInput: string;
  presentacion: string;
  cantidadInput: string;
}): EmpaqueLineaState {
  if (parsePositive(input.cajasInput) != null) {
    return {
      cajasInput: input.cajasInput,
      presentacion: input.presentacion,
      cantidadInput: input.cantidadInput,
      packHint: "",
      autoPackFields: [],
    };
  }

  const cantidad = parsePositive(input.cantidadInput);
  if (cantidad == null) {
    return {
      cajasInput: input.cajasInput,
      presentacion: input.presentacion,
      cantidadInput: input.cantidadInput,
      packHint: "",
      autoPackFields: [],
    };
  }

  let mejor: {
    presentacion: string;
    cajas: number;
    sobrante: number;
  } | null = null;

  for (const p of PRESENTACIONES_CAJA) {
    const peso = pesoPorCajaKg(p);
    if (peso == null) continue;
    const cajas = Math.ceil(cantidad / peso);
    const sobrante = Math.round((cajas * peso - cantidad) * 100) / 100;
    const gana =
      !mejor ||
      sobrante < mejor.sobrante - 0.001 ||
      (Math.abs(sobrante - mejor.sobrante) < 0.001 && cajas < mejor.cajas);
    if (gana) mejor = { presentacion: p, cajas, sobrante };
  }

  if (!mejor) {
    return {
      cajasInput: input.cajasInput,
      presentacion: input.presentacion,
      cantidadInput: input.cantidadInput,
      packHint: "",
      autoPackFields: [],
    };
  }

  return {
    cajasInput: String(mejor.cajas),
    presentacion: mejor.presentacion,
    cantidadInput: input.cantidadInput,
    packHint:
      mejor.sobrante > 0.001
        ? hintAproximado(
            cantidad,
            mejor.cajas,
            mejor.presentacion,
            mejor.sobrante,
          )
        : "",
    autoPackFields: ["cajasInput", "presentacion"],
  };
}

/**
 * Con cantidad fija y presentación elegida a mano: recalcula cajas (ceil).
 * Si aún no hay cantidad, delega a recalcularPorCajas.
 * Granel: limpia cajas.
 */
export function recalcularCajasPorPresentacion(input: {
  cajasInput: string;
  presentacion: string;
  cantidadInput: string;
}): EmpaqueLineaState {
  const presentacion = input.presentacion;
  const peso = pesoPorCajaKg(presentacion);

  if (peso == null) {
    if (presentacion === "Granel") {
      return {
        cajasInput: "",
        presentacion,
        cantidadInput: input.cantidadInput,
        packHint: "",
        autoPackFields: [],
      };
    }
    return {
      cajasInput: input.cajasInput,
      presentacion,
      cantidadInput: input.cantidadInput,
      packHint: "",
      autoPackFields: [],
    };
  }

  const cantidad = parsePositive(input.cantidadInput);
  if (cantidad == null) {
    return recalcularPorCajas(input);
  }

  const cajas = Math.ceil(cantidad / peso);
  const sobrante = Math.round((cajas * peso - cantidad) * 100) / 100;

  return {
    cajasInput: String(cajas),
    presentacion,
    cantidadInput: input.cantidadInput,
    packHint:
      sobrante > 0.001
        ? hintAproximado(cantidad, cajas, presentacion, sobrante)
        : "",
    autoPackFields: ["cajasInput"],
  };
}

/** Aplica empaque inicial a una línea recién mapeada por IA. */
export function aplicarEmpaqueInicialLinea(input: {
  cajasInput: string;
  presentacion: string;
  cantidadInput: string;
}): EmpaqueLineaState {
  const cajas = parsePositive(input.cajasInput);
  if (cajas != null) {
    return recalcularPorCajas(input);
  }
  if (parsePositive(input.cantidadInput) != null) {
    return sugerirEmpaqueDesdeCantidad(input);
  }
  return {
    cajasInput: input.cajasInput,
    presentacion: input.presentacion,
    cantidadInput: input.cantidadInput,
    packHint: "",
    autoPackFields: [],
  };
}

export const CAMPOS_OPERATIVOS_DOCS = [
  "fechaEntrega",
  "centroConsumo",
  "direccion",
  "anden",
  "contacto",
  "telefono",
  "ventanaDesde",
  "ventanaHasta",
] as const;

export type CampoOperativoDocs = (typeof CAMPOS_OPERATIVOS_DOCS)[number];

export function collectMissingFieldsDocs(
  values: Record<CampoOperativoDocs, string>,
): Set<string> {
  const missing = new Set<string>();
  for (const key of CAMPOS_OPERATIVOS_DOCS) {
    if (!values[key]?.trim()) missing.add(key);
  }
  return missing;
}
