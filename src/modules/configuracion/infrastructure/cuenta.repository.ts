import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import type {
  BodegaAssignCandidate,
  CuentaRecord,
  UpdateCuentaData,
  UpdateCuentaResult,
} from '../interfaces/cuenta.interfaces';

@Injectable()
export class CuentaRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCodigo(codigoCuenta: string): Promise<CuentaRecord | null> {
    return this.prisma.cuenta.findUnique({
      where: { codigoCuenta },
      select: {
        codigoCuenta: true,
        codigoEmpresa: true,
        nombreComercial: true,
        estaActiva: true,
      },
    });
  }

  findOtrasCuentasEmpresa(
    codigoEmpresa: string,
    codigoCuentaExcluir: string,
  ): Promise<{ codigoCuenta: string; nombreComercial: string }[]> {
    return this.prisma.cuenta.findMany({
      where: {
        codigoEmpresa,
        codigoCuenta: { not: codigoCuentaExcluir },
        estaActiva: true,
      },
      select: {
        codigoCuenta: true,
        nombreComercial: true,
      },
      orderBy: { nombreComercial: 'asc' },
    });
  }

  findBodegasActivasDeCuenta(
    codigoCuenta: string,
  ): Promise<{ idBodega: string }[]> {
    return this.prisma.bodega.findMany({
      where: { codigoCuenta, estaActiva: true },
      select: { idBodega: true },
    });
  }

  update(
    codigoCuenta: string,
    data: UpdateCuentaData,
  ): Promise<UpdateCuentaResult> {
    return this.prisma.cuenta.update({
      where: { codigoCuenta },
      data,
      select: {
        codigoCuenta: true,
        codigoEmpresa: true,
        nombreComercial: true,
        estaActiva: true,
      },
    });
  }

  findBodegasByIds(idsBodega: string[]): Promise<BodegaAssignCandidate[]> {
    if (idsBodega.length === 0) return Promise.resolve([]);

    return this.prisma.bodega.findMany({
      where: {
        idBodega: { in: idsBodega },
        estaActiva: true,
      },
      select: {
        idBodega: true,
        codigoCuenta: true,
        cuenta: { select: { codigoEmpresa: true } },
      },
    });
  }

  assignBodegasToCuenta(
    codigoCuenta: string,
    idsBodega: string[],
  ): Promise<{ count: number }> {
    if (idsBodega.length === 0) {
      return Promise.resolve({ count: 0 });
    }

    return this.prisma.bodega.updateMany({
      where: { idBodega: { in: idsBodega } },
      data: { codigoCuenta },
    });
  }
}
