import {
  DEFAULT_LIST_LIMIT,
  runDomainQuery,
} from "@/lib/supabase/domain-query";
import { DomainServiceError } from "@/lib/domain-service-error";
import { generateCodigoCuentaFromNombre } from "@/lib/generate-codigo-cuenta";
import { TENANT_HEADER_NAMES } from "@/lib/tenant-headers";
import { apiRequest } from "@/services/api";

export interface BodegaExternaListRow {
  idBodega: string;
  nombre: string;
  capacidad: number | null;
  bodegaAsignada: string;
}

interface BodegaExternaCuentaDbRow {
  nombre_comercial: string;
}

interface BodegaExternaDbRow {
  id_bodega: string;
  nombre: string;
  capacidad_slots: number | null;
  cuenta: BodegaExternaCuentaDbRow | BodegaExternaCuentaDbRow[] | null;
}

const BODEGA_EXTERNA_LIST_COLUMNS =
  "id_bodega,nombre,capacidad_slots,cuenta(nombre_comercial)";

function resolveCuentaNombre(
  cuenta: BodegaExternaDbRow["cuenta"],
): string {
  if (!cuenta) return "—";
  if (Array.isArray(cuenta)) {
    return cuenta[0]?.nombre_comercial ?? "—";
  }
  return cuenta.nombre_comercial ?? "—";
}

function mapBodegaExternaRow(row: BodegaExternaDbRow): BodegaExternaListRow {
  return {
    idBodega: row.id_bodega,
    nombre: row.nombre,
    capacidad: row.capacidad_slots,
    bodegaAsignada: resolveCuentaNombre(row.cuenta),
  };
}

async function resolveCuentaAsignada(codigoCuenta: string): Promise<{
  codigoCuenta: string;
  nombreComercial: string;
}> {
  const codigo = codigoCuenta.trim();
  if (!codigo) {
    throw new DomainServiceError(
      "Selecciona la cuenta destino de la bodega.",
      "INVALID_ARGUMENT",
    );
  }

  const rows = await runDomainQuery<
    { codigo_cuenta: string; nombre_comercial: string }[]
  >((client) => {
    const query = client
      .from("cuenta")
      .select("codigo_cuenta,nombre_comercial")
      .eq("esta_activa", true)
      .eq("codigo_cuenta", codigo)
      .limit(1);

    return query as unknown as Promise<{
      data: { codigo_cuenta: string; nombre_comercial: string }[] | null;
      error: { message: string } | null;
    }>;
  });

  const cuenta = rows[0];
  if (!cuenta?.codigo_cuenta) {
    throw new DomainServiceError(
      "La cuenta seleccionada no es válida.",
      "INVALID_ARGUMENT",
    );
  }

  return {
    codigoCuenta: cuenta.codigo_cuenta,
    nombreComercial: cuenta.nombre_comercial,
  };
}

/** Lista bodegas externas activas para el configurador (scope platform). */
export async function listBodegasExternasConfigurator(): Promise<
  BodegaExternaListRow[]
> {
  const rows = await runDomainQuery<BodegaExternaDbRow[]>((client) => {
    const query = client
      .from("bodega")
      .select(BODEGA_EXTERNA_LIST_COLUMNS)
      .eq("tipo", "externa")
      .eq("esta_activa", true)
      .order("nombre", { ascending: true })
      .limit(DEFAULT_LIST_LIMIT);

    return query as unknown as Promise<{
      data: BodegaExternaDbRow[] | null;
      error: { message: string } | null;
    }>;
  });

  return rows.map(mapBodegaExternaRow);
}

export interface CreateBodegaExternaInput {
  nombre: string;
  capacidad: number;
  codigoCuenta: string;
  idCreador?: string | null;
}

/** Crea una bodega externa desde el configurador (scope platform). */
export async function createBodegaExternaConfigurator(
  input: CreateBodegaExternaInput,
): Promise<BodegaExternaListRow> {
  const nombre = input.nombre.trim();
  const codigo = generateCodigoCuentaFromNombre(nombre);

  if (!nombre) {
    throw new DomainServiceError(
      "El nombre de la bodega es obligatorio.",
      "INVALID_ARGUMENT",
    );
  }

  if (!Number.isFinite(input.capacidad) || input.capacidad <= 0) {
    throw new DomainServiceError(
      "La capacidad debe ser un número mayor a cero.",
      "INVALID_ARGUMENT",
    );
  }

  if (!codigo) {
    throw new DomainServiceError(
      "No se pudo generar el código de la bodega.",
      "INVALID_ARGUMENT",
    );
  }

  const { codigoCuenta, nombreComercial } = await resolveCuentaAsignada(
    input.codigoCuenta,
  );

  const created = await apiRequest<{
    idBodega: string;
    capacidadSlots: number | null;
  }>("/configuracion/bodegas", {
    method: "POST",
    auth: true,
    headers: {
      [TENANT_HEADER_NAMES.codigoCuenta]: codigoCuenta,
    },
    body: {
      codigoCuenta,
      codigo,
      nombre,
      tipo: "externa",
      capacidadSlots: Math.trunc(input.capacidad),
    },
  });

  return {
    idBodega: created.idBodega,
    nombre,
    capacidad: Math.trunc(input.capacidad),
    bodegaAsignada: nombreComercial,
  };
}
