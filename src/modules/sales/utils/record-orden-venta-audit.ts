import type { PrismaService } from '../../../core/database/prisma.service';

type AuditAccion = 'creacion' | 'actualizacion' | 'cambio_estado' | 'eliminacion';

/**
 * Inserta eventos en auditoria_operacion (bitácora Cypher) por OT.
 * Best-effort: no lanza si falla el INSERT.
 */
export async function recordOrdenVentaAudit(
  prisma: PrismaService,
  input: {
    schemaName: string;
    codigoCuenta: string;
    idOrdenVenta: string;
    accion: AuditAccion;
    mensaje: string;
    idUsuario?: string | null;
    idBodega?: string | null;
    idOrdenesTrabajo?: readonly string[] | null;
    autorNombre?: string | null;
    payloadExtra?: Record<string, unknown>;
  },
): Promise<void> {
  const schema = input.schemaName?.trim();
  if (!schema || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) return;

  const codigoCuenta = input.codigoCuenta.trim();
  const idOrdenVenta = input.idOrdenVenta.trim();
  const mensaje = input.mensaje.trim();
  if (!codigoCuenta || !idOrdenVenta || !mensaje) return;

  const ots = [
    ...new Set(
      (input.idOrdenesTrabajo ?? [])
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  const targets = ots.length > 0 ? ots : [null];

  for (const idOrdenTrabajo of targets) {
    const payload = {
      mensaje,
      autorNombre: input.autorNombre?.trim() || null,
      ...(idOrdenTrabajo ? { idOrdenTrabajo } : {}),
      ...(input.payloadExtra ?? {}),
    };

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${schema}.auditoria_operacion (
           codigo_cuenta,
           id_bodega,
           id_usuario,
           accion,
           entidad,
           entidad_id,
           payload
         ) VALUES (
           $1,
           $2::uuid,
           $3::uuid,
           $4::public.tipo_auditoria,
           'orden_venta',
           $5::uuid,
           $6::jsonb
         )`,
        codigoCuenta,
        input.idBodega?.trim() || null,
        input.idUsuario?.trim() || null,
        input.accion,
        idOrdenVenta,
        JSON.stringify(payload),
      );
    } catch {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO ${schema}.auditoria_operacion (
             codigo_cuenta,
             id_bodega,
             id_usuario,
             accion,
             entidad,
             entidad_id,
             payload
           ) VALUES (
             $1,
             NULL,
             NULL,
             $2::public.tipo_auditoria,
             'orden_venta',
             $3::uuid,
             $4::jsonb
           )`,
          codigoCuenta,
          input.accion,
          idOrdenVenta,
          JSON.stringify(payload),
        );
      } catch {
        /* bitácora no debe tumbar el flujo */
      }
    }
  }
}
