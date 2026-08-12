import { Injectable } from '@nestjs/common';
import { BodegaTipo } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { TenantSchemaLocator } from '../../../core/database/tenant-schema.locator';
import type { CreateBodegaResult } from '../interfaces/bodega.interfaces';

export interface CuentaBodegaRecord {
  codigoCuenta: string;
  codigoEmpresa: string;
  estaActiva: boolean;
  schemaName: string | null;
  empresa: { estaActiva: boolean };
}

@Injectable()
export class BodegaRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schemaLocator: TenantSchemaLocator,
  ) {}

  async findCuenta(codigoCuenta: string): Promise<CuentaBodegaRecord | null> {
    const located = await this.schemaLocator.findCuentaByCodigo(codigoCuenta);
    if (!located) return null;

    // Preferir schema de la empresa (fuente de verdad) sobre el path de hallazgo.
    const schemaFromEmpresa =
      await this.schemaLocator.resolveSchemaByCodigoEmpresa(
        located.codigoEmpresa,
      );

    return {
      codigoCuenta: located.codigoCuenta,
      codigoEmpresa: located.codigoEmpresa,
      estaActiva: located.estaActiva,
      schemaName: schemaFromEmpresa ?? located.schemaName,
      empresa: { estaActiva: located.empresaEstaActiva },
    };
  }

  async createBodega(input: {
    codigoCuenta: string;
    codigo: string;
    nombre: string;
    tipo: BodegaTipo;
    capacidadSlots: number | null;
    idCreador: string;
    schemaName?: string | null;
  }): Promise<CreateBodegaResult> {
    let schemaName =
      input.schemaName !== undefined
        ? input.schemaName
        : await this.schemaLocator.resolveSchemaForCodigoCuenta(
            input.codigoCuenta,
          );

    if (!schemaName) {
      const cuenta = await this.findCuenta(input.codigoCuenta);
      schemaName = cuenta?.schemaName ?? null;
    }

    // INSERT calificado: no depender del search_path del pool (fallaba a public).
    const schema = this.schemaLocator.assertSafeSchemaIdent(
      schemaName ?? 'public',
    );

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        idBodega: string;
        codigoCuenta: string;
        codigo: string;
        nombre: string;
        tipo: BodegaTipo;
        capacidadSlots: number | null;
      }>
    >(
      `INSERT INTO ${schema}.bodega (
         codigo_cuenta,
         codigo,
         nombre,
         tipo,
         capacidad_slots,
         id_creador,
         esta_activa
       ) VALUES (
         $1,
         $2,
         $3,
         $4::public.bodega_tipo,
         $5,
         $6::uuid,
         true
       )
       RETURNING
         id_bodega AS "idBodega",
         codigo_cuenta AS "codigoCuenta",
         codigo,
         nombre,
         tipo,
         capacidad_slots AS "capacidadSlots"`,
      input.codigoCuenta,
      input.codigo,
      input.nombre,
      input.tipo,
      input.capacidadSlots,
      input.idCreador,
    );

    const created = rows[0];
    if (!created) {
      throw new Error(`No se pudo insertar bodega en schema ${schema}`);
    }

    return created;
  }
}
