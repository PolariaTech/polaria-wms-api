import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { PRESENCIA_TTL_MS } from '../constants/operations.constants';

export type SesionOperativaRow = Prisma.SesionOperativaGetPayload<object>;

@Injectable()
export class SesionOperativaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertPing(
    idUsuario: string,
    codigoCuenta: string,
    idBodega: string,
  ): Promise<SesionOperativaRow> {
    const now = new Date();
    const expiraEn = new Date(now.getTime() + PRESENCIA_TTL_MS);

    return this.prisma.sesionOperativa.upsert({
      where: {
        idUsuario_codigoCuenta_idBodega: {
          idUsuario,
          codigoCuenta,
          idBodega,
        },
      },
      create: {
        idUsuario,
        codigoCuenta,
        idBodega,
        ultimoPing: now,
        expiraEn,
      },
      update: {
        ultimoPing: now,
        expiraEn,
      },
    });
  }

  async findByUsuarios(
    codigoCuenta: string,
    idBodega: string,
    idUsuarios: string[],
  ): Promise<SesionOperativaRow[]> {
    if (idUsuarios.length === 0) {
      return [];
    }

    return this.prisma.sesionOperativa.findMany({
      where: {
        codigoCuenta,
        idBodega,
        idUsuario: { in: idUsuarios },
      },
    });
  }

  async isDisponible(
    idUsuario: string,
    codigoCuenta: string,
    idBodega: string,
  ): Promise<boolean> {
    const sesion = await this.prisma.sesionOperativa.findUnique({
      where: {
        idUsuario_codigoCuenta_idBodega: {
          idUsuario,
          codigoCuenta,
          idBodega,
        },
      },
    });

    if (!sesion) {
      return false;
    }

    return sesion.expiraEn.getTime() > Date.now();
  }
}
