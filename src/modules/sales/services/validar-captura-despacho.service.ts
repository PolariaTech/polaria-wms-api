import { ConflictException, Injectable } from '@nestjs/common';
import { EstadoOrdenVenta } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';

export class CapturaDespachoRequeridaError extends Error {
  constructor(message = 'CAPTURA_DESPACHO_REQUERIDA') {
    super(message);
  }
}

type CapturaRow = {
  id_orden_trabajo: string | null;
  payload: unknown;
  url_foto: string | null;
};

function campoLleno(
  campos: Record<string, string> | undefined,
  keys: readonly string[],
): boolean {
  if (!campos) return false;
  const lower = new Map(
    Object.entries(campos).map(([key, value]) => [
      key.toLowerCase(),
      value?.trim() ?? '',
    ]),
  );
  return keys.some((key) => {
    if (campos[key]?.trim()) return true;
    return Boolean(lower.get(key.toLowerCase()));
  });
}

/** Misma regla que web `capturaTieneDespacho` (caja Despachó con nombre u hora). */
export function capturaPayloadTieneDespacho(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const campos = (payload as { campos?: Record<string, string> }).campos;
  return campoLleno(campos, [
    'despachoNombre',
    'Despachó nombre',
    'Despachó',
    'despachoHora',
    'Despachó hora',
  ]);
}

/**
 * REQ-243: exige captura escaneada con check-in Despachó antes del despacho operativo.
 */
export async function assertOvTieneCapturaDespacho(
  prisma: PrismaService,
  locator: TenantSchemaLocator,
  input: { codigoCuenta: string; idOrdenVenta: string },
): Promise<void> {
  const cuenta = await locator.findCuentaByCodigo(input.codigoCuenta.trim());
  const schemaRaw = cuenta?.schemaName?.trim() || 'public';
  const schema = locator.assertSafeSchemaIdent(schemaRaw);

  let rows: CapturaRow[] = [];
  try {
    rows = await prisma.$queryRawUnsafe<CapturaRow[]>(
      `SELECT id_orden_trabajo, payload, url_foto
       FROM ${schema}.orden_venta_surtido_captura
       WHERE id_orden_venta = $1`,
      input.idOrdenVenta,
    );
  } catch {
    throw new CapturaDespachoRequeridaError('CAPTURA_DESPACHO_REQUERIDA');
  }

  const conDespacho = rows.some((row) =>
    capturaPayloadTieneDespacho(row.payload),
  );
  if (!conDespacho) {
    throw new CapturaDespachoRequeridaError('CAPTURA_DESPACHO_REQUERIDA');
  }
}

/** REQ-243: OT → zona salida; lanza Error genérico del repo de OT. */
export async function assertCapturaDespachoOtSalida(
  prisma: PrismaService,
  locator: TenantSchemaLocator,
  input: { codigoCuenta: string; idOrdenVenta: string },
): Promise<void> {
  try {
    await assertOvTieneCapturaDespacho(prisma, locator, input);
  } catch (error) {
    if (error instanceof CapturaDespachoRequeridaError) {
      throw new Error('CAPTURA_DESPACHO_REQUERIDA');
    }
    throw error;
  }
}

const ESTADOS_OV_PAQUETE: EstadoOrdenVenta[] = [
  EstadoOrdenVenta.confirmada,
  EstadoOrdenVenta.en_preparacion,
  EstadoOrdenVenta.parcialmente_despachada,
  EstadoOrdenVenta.despachada,
];

type OrdenParaPaquete = {
  idOrdenVenta: string;
  codigo: string;
  estado: EstadoOrdenVenta;
  lineas: unknown[];
  guiasEnvio: unknown[];
};

/** REQ-243: valida estado/líneas/guías + check-in Despachó por cada OV del paquete. */
export async function assertOrdenesListasParaPaquete(
  prisma: PrismaService,
  locator: TenantSchemaLocator,
  codigoCuenta: string,
  ordenes: readonly OrdenParaPaquete[],
): Promise<void> {
  for (const orden of ordenes) {
    if (!ESTADOS_OV_PAQUETE.includes(orden.estado)) {
      throw new Error(`OV_ESTADO_INVALIDO:${orden.codigo}`);
    }
    if (orden.lineas.length === 0) {
      throw new Error(`OV_SIN_LINEAS:${orden.codigo}`);
    }
    if (orden.guiasEnvio.length > 0) {
      throw new Error(`OV_YA_EN_TRANSPORTE:${orden.codigo}`);
    }
    try {
      await assertOvTieneCapturaDespacho(prisma, locator, {
        codigoCuenta,
        idOrdenVenta: orden.idOrdenVenta,
      });
    } catch (error) {
      if (error instanceof CapturaDespachoRequeridaError) {
        throw new ConflictException(
          `La venta ${orden.codigo} no tiene check-in Despachó escaneado desde la app. Escaneá la hoja en captura-orden antes de armar el paquete.`,
        );
      }
      throw error;
    }
  }
}

@Injectable()
export class ValidarCapturaDespachoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locator: TenantSchemaLocator,
  ) {}

  assertOvTieneCapturaDespacho(input: {
    codigoCuenta: string;
    idOrdenVenta: string;
  }): Promise<void> {
    return assertOvTieneCapturaDespacho(this.prisma, this.locator, input);
  }
}
