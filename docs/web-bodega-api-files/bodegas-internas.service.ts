import {
  DEFAULT_LIST_LIMIT,
  runDomainQuery,
} from "@/lib/supabase/domain-query";
import { DomainServiceError } from "@/lib/domain-service-error";
import { generateCodigoCuentaFromNombre } from "@/lib/generate-codigo-cuenta";
import { TENANT_HEADER_NAMES } from "@/lib/tenant-headers";
import { ApiError, apiRequest } from "@/services/api";

export interface BodegaInternaListRow {
  idBodega: string;
  nombre: string;
  capacidad: number | null;
  bodegaAsignada: string;
}

interface BodegaInternaCuentaDbRow {
  nombre_comercial: string;
}

interface BodegaInternaDbRow {
  id_bodega: string;
  nombre: string;
  capacidad_slots: number | null;
  cuenta: BodegaInternaCuentaDbRow | BodegaInternaCuentaDbRow[] | null;
}

const BODEGA_INTERNA_LIST_COLUMNS =
  "id_bodega,nombre,capacidad_slots,cuenta(nombre_comercial)";

function resolveCuentaNombre(
  cuenta: BodegaInternaDbRow["cuenta"],
): string {
  if (!cuenta) return "—";
  if (Array.isArray(cuenta)) {
    return cuenta[0]?.nombre_comercial ?? "—";
  }
  return cuenta.nombre_comercial ?? "—";
}

function mapBodegaInternaRow(row: BodegaInternaDbRow): BodegaInternaListRow {
  return {
    idBodega: row.id_bodega,
    nombre: row.nombre,
    capacidad: row.capacidad_slots,
    bodegaAsignada: resolveCuentaNombre(row.cuenta),
  };
}

export interface CreateBodegaInternaInput {
  nombre: string;
  capacidad: number;
  codigoCuenta: string;
  idCreador?: string | null;
}

async function resolveCuentaAsignada(codigoCuenta: string): Promise<{
  codigoCuenta: string;
  codigoEmpresa: string;
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
    { codigo_cuenta: string; codigo_empresa: string; nombre_comercial: string }[]
  >((client) => {
    const query = client
      .from("cuenta")
      .select("codigo_cuenta,codigo_empresa,nombre_comercial")
      .eq("esta_activa", true)
      .eq("codigo_cuenta", codigo)
      .limit(1);

    return query as unknown as Promise<{
      data:
        | { codigo_cuenta: string; codigo_empresa: string; nombre_comercial: string }[]
        | null;
      error: { message: string } | null;
    }>;
  });

  const cuenta = rows[0];
  if (!cuenta?.codigo_cuenta || !cuenta.codigo_empresa) {
    throw new DomainServiceError(
      "La cuenta seleccionada no es válida.",
      "INVALID_ARGUMENT",
    );
  }

  return {
    codigoCuenta: cuenta.codigo_cuenta,
    codigoEmpresa: cuenta.codigo_empresa,
    nombreComercial: cuenta.nombre_comercial,
  };
}

/**
 * Inicializa el layout operativo de la bodega vía API Nest.
 * Si falla, la bodega ya persistida en Supabase NO se revierte (sin rollback).
 */
async function bootstrapBodegaLayout(params: {
  idBodega: string;
  codigoEmpresa: string;
  codigoCuenta: string;
}): Promise<void> {
  try {
    await apiRequest<void>(
      `/configuracion/bodegas/${encodeURIComponent(params.idBodega)}/bootstrap-layout`,
      {
        method: "POST",
        auth: true,
        headers: {
          [TENANT_HEADER_NAMES.codigoEmpresa]: params.codigoEmpresa,
          [TENANT_HEADER_NAMES.codigoCuenta]: params.codigoCuenta,
          [TENANT_HEADER_NAMES.idBodega]: params.idBodega,
        },
      },
    );
  } catch (error) {
    const detail =
      error instanceof ApiError
        ? error.message
        : "Error desconocido al inicializar el layout.";
    throw new DomainServiceError(
      `La bodega se creó, pero no se pudo inicializar el layout: ${detail}`,
      "MUTATION_FAILED",
      error,
    );
  }
}

/** Lista bodegas internas activas para el configurador (scope platform). */
export async function listBodegasInternasConfigurator(): Promise<
  BodegaInternaListRow[]
> {
  const rows = await runDomainQuery<BodegaInternaDbRow[]>((client) => {
    const query = client
      .from("bodega")
      .select(BODEGA_INTERNA_LIST_COLUMNS)
      .eq("tipo", "interna")
      .eq("esta_activa", true)
      .order("nombre", { ascending: true })
      .limit(DEFAULT_LIST_LIMIT);

    return query as unknown as Promise<{
      data: BodegaInternaDbRow[] | null;
      error: { message: string } | null;
    }>;
  });

  return rows.map(mapBodegaInternaRow);
}

/** Crea una bodega interna desde el configurador (scope platform). */
export async function createBodegaInternaConfigurator(
  input: CreateBodegaInternaInput,
): Promise<BodegaInternaListRow> {
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

  const { codigoCuenta, codigoEmpresa, nombreComercial } =
    await resolveCuentaAsignada(input.codigoCuenta);

  const created = await apiRequest<{
    idBodega: string;
    capacidadSlots: number | null;
  }>("/configuracion/bodegas", {
    method: "POST",
    auth: true,
    headers: {
      [TENANT_HEADER_NAMES.codigoEmpresa]: codigoEmpresa,
      [TENANT_HEADER_NAMES.codigoCuenta]: codigoCuenta,
    },
    body: {
      codigoCuenta,
      codigo,
      nombre,
      tipo: "interna",
      capacidadSlots: Math.trunc(input.capacidad),
    },
  });

  const idBodega = created.idBodega;

  await bootstrapBodegaLayout({
    idBodega,
    codigoEmpresa,
    codigoCuenta,
  });

  return {
    idBodega,
    nombre,
    capacidad: Math.trunc(input.capacidad),
    bodegaAsignada: nombreComercial,
  };
}
