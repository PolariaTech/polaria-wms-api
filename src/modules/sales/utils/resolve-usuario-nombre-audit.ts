import type { PrismaService } from '../../../core/database/prisma.service';

/** Nombre visible para bitácora; null si no hay usuario o falla la lectura. */
export async function resolveUsuarioNombreAudit(
  prisma: PrismaService,
  idUsuario?: string | null,
): Promise<string | null> {
  const id = idUsuario?.trim();
  if (!id) return null;

  try {
    const row = await prisma.usuario.findUnique({
      where: { idUsuario: id },
      select: { nombre: true },
    });
    const nombre = row?.nombre?.trim();
    return nombre || null;
  } catch {
    return null;
  }
}

/** Mensaje de confirmación/emisión con autor, sin pisar eventos previos. */
export function mensajePedidoConfirmadoBitacora(
  autorNombre?: string | null,
): string {
  const autor = autorNombre?.trim();
  if (autor) {
    return `Pedido confirmado y enviado a bodega por ${autor}.`;
  }
  return 'Pedido enviado a bodega (emitido).';
}
