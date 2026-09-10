import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import type {
  BodegaAssignCandidate,
  CuentaRecord,
  UpdateCuentaData,
  UpdateCuentaResult,
} from '../interfaces/cuenta.interfaces';

type CuentaLocate = CuentaRecord & { schemaName: string | null };

@Injectable()
export class CuentaRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly cuentaSelect = {
    codigoCuenta: true,
    codigoEmpresa: true,
    nombreComercial: true,
    estaActiva: true,
    idBodegaDefault: true,
  } as const;

  /** Busca en public y, si no está, en schemas emp_* de empresas. */
  async findByCodigo(codigoCuenta: string): Promise<CuentaLocate | null> {
    const inPublic = await this.prisma.cuenta.findUnique({
      where: { codigoCuenta },
      select: this.cuentaSelect,
    });
    if (inPublic) {
      return { ...inPublic, schemaName: null };
    }

    const empresas = await this.prisma.empresa.findMany({
      where: { schemaName: { not: null } },
      select: { schemaName: true },
    });

    for (const empresa of empresas) {
      if (!empresa.schemaName) continue;
      const found = await this.prisma
        .forSchema(empresa.schemaName)
        .cuenta.findUnique({
          where: { codigoCuenta },
          select: this.cuentaSelect,
        });
      if (found) {
        return { ...found, schemaName: empresa.schemaName };
      }
    }

    return null;
  }

  findOtrasCuentasEmpresa(
    codigoEmpresa: string,
    codigoCuentaExcluir: string,
    schemaName?: string | null,
  ): Promise<{ codigoCuenta: string; nombreComercial: string }[]> {
    return this.prisma.forSchema(schemaName ?? null).cuenta.findMany({
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
    schemaName?: string | null,
  ): Promise<{ idBodega: string }[]> {
    return this.prisma.forSchema(schemaName ?? null).bodega.findMany({
      where: { codigoCuenta, estaActiva: true },
      select: { idBodega: true },
    });
  }

  update(
    codigoCuenta: string,
    data: UpdateCuentaData,
    schemaName?: string | null,
  ): Promise<UpdateCuentaResult> {
    return this.prisma.forSchema(schemaName ?? null).cuenta.update({
      where: { codigoCuenta },
      data,
      select: {
        codigoCuenta: true,
        codigoEmpresa: true,
        nombreComercial: true,
        estaActiva: true,
        idBodegaDefault: true,
      },
    });
  }

  findBodegasByIds(
    idsBodega: string[],
    schemaName?: string | null,
  ): Promise<BodegaAssignCandidate[]> {
    if (idsBodega.length === 0) return Promise.resolve([]);

    return this.prisma.forSchema(schemaName ?? null).bodega.findMany({
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
    schemaName?: string | null,
  ): Promise<{ count: number }> {
    if (idsBodega.length === 0) {
      return Promise.resolve({ count: 0 });
    }

    return this.prisma.forSchema(schemaName ?? null).bodega.updateMany({
      where: { idBodega: { in: idsBodega } },
      data: { codigoCuenta },
    });
  }
}
