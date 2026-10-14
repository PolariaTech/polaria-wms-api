import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import type {
  BodegaAssignCandidate,
  CuentaRecord,
  UpdateCuentaData,
  UpdateCuentaResult,
} from '../interfaces/cuenta.interfaces';

type CuentaLocate = CuentaRecord & { schemaName: string | null };

const CUENTA_SELECT_SQL = `
  codigo_cuenta AS "codigoCuenta",
  codigo_empresa AS "codigoEmpresa",
  nombre_comercial AS "nombreComercial",
  esta_activa AS "estaActiva",
  acceso_wms AS "accesoWms",
  acceso_mateo AS "accesoMateo",
  id_bodega_default AS "idBodegaDefault"
`;

@Injectable()
export class CuentaRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca en public y, si no está, en schemas emp_* de empresas.
   * SQL calificado: Prisma @@schema("public") no alcanza tablas emp_*.
   */
  async findByCodigo(codigoCuenta: string): Promise<CuentaLocate | null> {
    const inPublic = await this.findCuentaInSchema('public', codigoCuenta);
    if (inPublic) {
      return { ...inPublic, schemaName: null };
    }

    const empresas = await this.prisma.empresa.findMany({
      where: { schemaName: { not: null } },
      select: { schemaName: true },
    });

    for (const empresa of empresas) {
      if (!empresa.schemaName) continue;
      const found = await this.findCuentaInSchema(
        empresa.schemaName,
        codigoCuenta,
      );
      if (found) {
        return { ...found, schemaName: empresa.schemaName };
      }
    }

    return null;
  }

  async findOtrasCuentasEmpresa(
    codigoEmpresa: string,
    codigoCuentaExcluir: string,
    schemaName?: string | null,
  ): Promise<{ codigoCuenta: string; nombreComercial: string }[]> {
    const schema = this.assertSafeSchemaIdent(schemaName ?? 'public');
    return this.prisma.$queryRawUnsafe<
      { codigoCuenta: string; nombreComercial: string }[]
    >(
      `SELECT codigo_cuenta AS "codigoCuenta",
              nombre_comercial AS "nombreComercial"
         FROM ${schema}.cuenta
        WHERE codigo_empresa = $1
          AND codigo_cuenta <> $2
          AND esta_activa = true
        ORDER BY nombre_comercial ASC`,
      codigoEmpresa,
      codigoCuentaExcluir,
    );
  }

  async findBodegasActivasDeCuenta(
    codigoCuenta: string,
    schemaName?: string | null,
  ): Promise<{ idBodega: string }[]> {
    const schema = this.assertSafeSchemaIdent(schemaName ?? 'public');
    return this.prisma.$queryRawUnsafe<{ idBodega: string }[]>(
      `SELECT id_bodega AS "idBodega"
         FROM ${schema}.bodega
        WHERE codigo_cuenta = $1
          AND esta_activa = true`,
      codigoCuenta,
    );
  }

  async update(
    codigoCuenta: string,
    data: UpdateCuentaData,
    schemaName?: string | null,
  ): Promise<UpdateCuentaResult> {
    const schema = this.assertSafeSchemaIdent(schemaName ?? 'public');
    const sets: string[] = [];
    const values: unknown[] = [];

    const push = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (data.nombreComercial !== undefined) {
      push('nombre_comercial', data.nombreComercial);
    }
    if (data.estaActiva !== undefined) {
      push('esta_activa', data.estaActiva);
    }
    if (data.accesoWms !== undefined) {
      push('acceso_wms', data.accesoWms);
    }
    if (data.accesoMateo !== undefined) {
      push('acceso_mateo', data.accesoMateo);
    }
    if (data.idBodegaDefault !== undefined) {
      push('id_bodega_default', data.idBodegaDefault);
    }

    if (sets.length === 0) {
      const existing = await this.findCuentaInSchema(schema, codigoCuenta);
      if (!existing) {
        throw new Error(`Cuenta ${codigoCuenta} no encontrada`);
      }
      return existing;
    }

    values.push(codigoCuenta);
    const rows = await this.prisma.$queryRawUnsafe<UpdateCuentaResult[]>(
      `UPDATE ${schema}.cuenta
          SET ${sets.join(', ')}
        WHERE codigo_cuenta = $${values.length}
        RETURNING ${CUENTA_SELECT_SQL}`,
      ...values,
    );

    const updated = rows[0];
    if (!updated) {
      throw new Error(`Cuenta ${codigoCuenta} no encontrada`);
    }
    return updated;
  }

  async findBodegasByIds(
    idsBodega: string[],
    schemaName?: string | null,
  ): Promise<BodegaAssignCandidate[]> {
    if (idsBodega.length === 0) return [];

    const schema = this.assertSafeSchemaIdent(schemaName ?? 'public');
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        idBodega: string;
        codigoCuenta: string;
        codigoEmpresa: string;
      }>
    >(
      `SELECT b.id_bodega AS "idBodega",
              b.codigo_cuenta AS "codigoCuenta",
              c.codigo_empresa AS "codigoEmpresa"
         FROM ${schema}.bodega b
         JOIN ${schema}.cuenta c ON c.codigo_cuenta = b.codigo_cuenta
        WHERE b.id_bodega = ANY($1::uuid[])
          AND b.esta_activa = true`,
      idsBodega,
    );

    return rows.map((row) => ({
      idBodega: row.idBodega,
      codigoCuenta: row.codigoCuenta,
      cuenta: { codigoEmpresa: row.codigoEmpresa },
    }));
  }

  async assignBodegasToCuenta(
    codigoCuenta: string,
    idsBodega: string[],
    schemaName?: string | null,
  ): Promise<{ count: number }> {
    if (idsBodega.length === 0) {
      return { count: 0 };
    }

    const schema = this.assertSafeSchemaIdent(schemaName ?? 'public');
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE ${schema}.bodega
          SET codigo_cuenta = $1
        WHERE id_bodega = ANY($2::uuid[])`,
      codigoCuenta,
      idsBodega,
    );

    return { count: Number(result) };
  }

  private assertSafeSchemaIdent(schema: string): string {
    if (!/^[a-z][a-z0-9_]*$/.test(schema)) {
      throw new Error(`Nombre de schema inválido: ${schema}`);
    }
    return schema;
  }

  private async findCuentaInSchema(
    schemaName: string,
    codigoCuenta: string,
  ): Promise<CuentaRecord | null> {
    const schema = this.assertSafeSchemaIdent(schemaName);
    const rows = await this.prisma.$queryRawUnsafe<CuentaRecord[]>(
      `SELECT ${CUENTA_SELECT_SQL}
         FROM ${schema}.cuenta
        WHERE codigo_cuenta = $1
        LIMIT 1`,
      codigoCuenta,
    );
    return rows[0] ?? null;
  }
}
