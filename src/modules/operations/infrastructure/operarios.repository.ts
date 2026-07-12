import { Injectable } from '@nestjs/common';
import { EstadoTarea, WmsRol } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

export interface OperarioBodegaRow {
  idUsuario: string;
  nombre: string;
  username: string;
  estaActivo: boolean;
}

@Injectable()
export class OperariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBodegaEnCuenta(codigoCuenta: string, idBodega: string) {
    return this.prisma.bodega.findFirst({
      where: { idBodega, codigoCuenta, estaActiva: true },
      select: { idBodega: true, codigoCuenta: true },
    });
  }

  listOperariosEnBodega(
    codigoCuenta: string,
    idBodega: string,
  ): Promise<OperarioBodegaRow[]> {
    return this.prisma.usuario.findMany({
      where: {
        idRol: WmsRol.operario,
        asignacionesBodega: {
          some: {
            idBodega,
            estaActiva: true,
            idRol: WmsRol.operario,
            bodega: { codigoCuenta },
          },
        },
      },
      select: {
        idUsuario: true,
        nombre: true,
        username: true,
        estaActivo: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  findOperarioEnBodega(
    idUsuario: string,
    codigoCuenta: string,
    idBodega: string,
  ): Promise<OperarioBodegaRow | null> {
    return this.prisma.usuario.findFirst({
      where: {
        idUsuario,
        idRol: WmsRol.operario,
        asignacionesBodega: {
          some: {
            idBodega,
            estaActiva: true,
            idRol: WmsRol.operario,
            bodega: { codigoCuenta },
          },
        },
      },
      select: {
        idUsuario: true,
        nombre: true,
        username: true,
        estaActivo: true,
      },
    });
  }

  async countTareasPendientesPorOperario(
    codigoCuenta: string,
    idBodega: string,
    idUsuarios: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    for (const id of idUsuarios) {
      counts.set(id, 0);
    }

    if (idUsuarios.length === 0) {
      return counts;
    }

    const rows = await this.prisma.tareaCola.groupBy({
      by: ['idAsignado'],
      where: {
        codigoCuenta,
        idBodega,
        idAsignado: { in: idUsuarios },
        estado: { in: [EstadoTarea.pendiente, EstadoTarea.en_proceso] },
      },
      _count: { idTarea: true },
    });

    for (const row of rows) {
      if (row.idAsignado) {
        counts.set(row.idAsignado, row._count.idTarea);
      }
    }

    return counts;
  }
}
