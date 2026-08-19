import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export type LocatedCuenta = {
  codigoCuenta: string;
  codigoEmpresa: string;
  nombreComercial: string;
  estaActiva: boolean;
  schemaName: string | null;
  empresaEstaActiva: boolean;
};

export type LocatedBodega = {
  idBodega: string;
  codigoCuenta: string;
  codigo: string;
  nombre: string;
  tipo: string;
  capacidadSlots: number | null;
  estaActiva: boolean;
  schemaName: string | null;
};

/**
 * Localiza filas de negocio en public o emp_* sin depender del ALS del request.
 * Usar desde endpoints de configurador (schemaName = null).
 */
@Injectable()
export class TenantSchemaLocator {
  constructor(private readonly prisma: PrismaService) {}

  assertSafeSchemaIdent(schema: string): string {
    if (!/^[a-z][a-z0-9_]*$/.test(schema)) {
      throw new Error(`Nombre de schema inválido: ${schema}`);
    }
    return schema;
  }

  async resolveSchemaByCodigoEmpresa(
    codigoEmpresa: string,
  ): Promise<string | null> {
    const empresa = await this.prisma.empresa.findUnique({
      where: { codigoEmpresa },
      select: { schemaName: true },
    });
    return empresa?.schemaName ?? null;
  }

  async findCuentaByCodigo(
    codigoCuenta: string,
  ): Promise<LocatedCuenta | null> {
    const inPublic = await this.prisma.cuenta.findUnique({
      where: { codigoCuenta },
      select: {
        codigoCuenta: true,
        codigoEmpresa: true,
        nombreComercial: true,
        estaActiva: true,
        empresa: { select: { estaActiva: true, schemaName: true } },
      },
    });

    if (inPublic) {
      return {
        codigoCuenta: inPublic.codigoCuenta,
        codigoEmpresa: inPublic.codigoEmpresa,
        nombreComercial: inPublic.nombreComercial,
        estaActiva: inPublic.estaActiva,
        schemaName: inPublic.empresa?.schemaName ?? null,
        empresaEstaActiva: inPublic.empresa?.estaActiva ?? false,
      };
    }

    const empresas = await this.prisma.empresa.findMany({
      where: { schemaName: { not: null } },
      select: {
        codigoEmpresa: true,
        schemaName: true,
        estaActiva: true,
      },
    });

    for (const empresa of empresas) {
      if (!empresa.schemaName) continue;
      const row = await this.queryCuentaInSchema(
        empresa.schemaName,
        codigoCuenta,
      );
      if (!row) continue;
      return {
        ...row,
        schemaName: empresa.schemaName,
        empresaEstaActiva: empresa.estaActiva,
      };
    }

    return null;
  }

  async findBodegaById(idBodega: string): Promise<LocatedBodega | null> {
    const inPublic = await this.prisma.bodega.findUnique({
      where: { idBodega },
      select: {
        idBodega: true,
        codigoCuenta: true,
        codigo: true,
        nombre: true,
        tipo: true,
        capacidadSlots: true,
        estaActiva: true,
      },
    });

    if (inPublic) {
      const schemaName = await this.resolveSchemaForCodigoCuenta(
        inPublic.codigoCuenta,
      );
      return { ...inPublic, tipo: String(inPublic.tipo), schemaName };
    }

    const empresas = await this.prisma.empresa.findMany({
      where: { schemaName: { not: null } },
      select: { schemaName: true },
    });

    for (const empresa of empresas) {
      if (!empresa.schemaName) continue;
      const row = await this.queryBodegaInSchema(empresa.schemaName, idBodega);
      if (!row) continue;
      return { ...row, schemaName: empresa.schemaName };
    }

    return null;
  }

  /** Schema donde vive la cuenta (null = public). */
  async resolveSchemaForCodigoCuenta(
    codigoCuenta: string,
  ): Promise<string | null> {
    const located = await this.findCuentaByCodigo(codigoCuenta);
    return located?.schemaName ?? null;
  }

  private async queryCuentaInSchema(
    schemaName: string,
    codigoCuenta: string,
  ): Promise<Omit<LocatedCuenta, 'schemaName' | 'empresaEstaActiva'> | null> {
    const schema = this.assertSafeSchemaIdent(schemaName);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        codigoCuenta: string;
        codigoEmpresa: string;
        nombreComercial: string;
        estaActiva: boolean;
      }>
    >(
      `SELECT codigo_cuenta AS "codigoCuenta",
              codigo_empresa AS "codigoEmpresa",
              nombre_comercial AS "nombreComercial",
              esta_activa AS "estaActiva"
       FROM ${schema}.cuenta
       WHERE codigo_cuenta = $1
       LIMIT 1`,
      codigoCuenta,
    );
    return rows[0] ?? null;
  }

  private async queryBodegaInSchema(
    schemaName: string,
    idBodega: string,
  ): Promise<Omit<LocatedBodega, 'schemaName'> | null> {
    const schema = this.assertSafeSchemaIdent(schemaName);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        idBodega: string;
        codigoCuenta: string;
        codigo: string;
        nombre: string;
        tipo: string;
        capacidadSlots: number | null;
        estaActiva: boolean;
      }>
    >(
      `SELECT id_bodega AS "idBodega",
              codigo_cuenta AS "codigoCuenta",
              codigo,
              nombre,
              tipo::text AS tipo,
              capacidad_slots AS "capacidadSlots",
              esta_activa AS "estaActiva"
       FROM ${schema}.bodega
       WHERE id_bodega = $1::uuid
       LIMIT 1`,
      idBodega,
    );
    return rows[0] ?? null;
  }
}
