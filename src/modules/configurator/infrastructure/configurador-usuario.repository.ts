import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WmsRol } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { phoneLookupVariants } from '../../../shared/utils/phone.util';

export interface CreateUsuarioRecordInput {
  idAuth: string;
  idRol: WmsRol;
  codigoEmpresa: string | null;
  codigoCuenta: string | null;
  nombre: string;
  username: string;
  correo: string;
  telefono?: string | null;
  idCreador: string;
  idBodega?: string;
  accesoWms?: boolean;
  accesoMateo?: boolean;
}

type CuentaLite = {
  codigoCuenta: string;
  codigoEmpresa: string;
  nombreComercial: string;
  estaActiva: boolean;
};

type EmpresaLite = {
  codigoEmpresa: string;
  estaActiva: boolean;
  schemaName: string | null;
};

@Injectable()
export class ConfiguradorUsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string) {
    return this.prisma.usuario.findUnique({
      where: { username: username.trim() },
    });
  }

  findById(idUsuario: string) {
    return this.prisma.usuario.findUnique({
      where: { idUsuario },
    });
  }

  findByCorreo(correo: string) {
    return this.prisma.usuario.findUnique({
      where: { correo: correo.trim().toLowerCase() },
    });
  }

  findByTelefono(telefono: string) {
    const variants = phoneLookupVariants(telefono);
    if (variants.length === 0) return Promise.resolve(null);

    return this.prisma.usuario.findFirst({
      where: { telefono: { in: variants } },
    });
  }

  updateUsuario(
    idUsuario: string,
    data: {
      nombre?: string;
      correo?: string;
      telefono?: string | null;
      estaActivo?: boolean;
      accesoWms?: boolean;
      accesoMateo?: boolean;
    },
  ) {
    return this.prisma.usuario.update({
      where: { idUsuario },
      data,
    });
  }

  findRol(idRol: WmsRol) {
    return this.prisma.rol.findUnique({ where: { idRol } });
  }

  findCuentaWithEmpresa(codigoCuenta: string, codigoEmpresa?: string | null) {
    return this.findCuentaWithEmpresaAcrossSchemas(codigoCuenta, codigoEmpresa);
  }

  /**
   * Busca cuenta en el schema de la empresa (emp_* o public).
   * Usa SQL calificado para no depender del search_path del pool.
   */
  private async findCuentaWithEmpresaAcrossSchemas(
    codigoCuenta: string,
    codigoEmpresa?: string | null,
  ) {
    if (codigoEmpresa) {
      const empresa = await this.prisma.empresa.findUnique({
        where: { codigoEmpresa },
        select: {
          codigoEmpresa: true,
          estaActiva: true,
          schemaName: true,
        },
      });
      if (!empresa) return null;

      const cuenta = await this.findCuentaInSchema(
        empresa.schemaName,
        codigoCuenta,
      );
      if (!cuenta) return null;

      return { ...cuenta, empresa };
    }

    const include = { empresa: true } as const;

    const inPublic = await this.prisma.cuenta.findUnique({
      where: { codigoCuenta },
      include,
    });
    if (inPublic) return inPublic;

    const empresas = await this.prisma.empresa.findMany({
      where: { schemaName: { not: null } },
      select: { schemaName: true, estaActiva: true, codigoEmpresa: true },
    });

    for (const empresa of empresas) {
      if (!empresa.schemaName) continue;

      const found = await this.findCuentaInSchema(
        empresa.schemaName,
        codigoCuenta,
      );
      if (!found) continue;

      return {
        ...found,
        empresa: {
          codigoEmpresa: empresa.codigoEmpresa,
          estaActiva: empresa.estaActiva,
          schemaName: empresa.schemaName,
        } satisfies EmpresaLite,
      };
    }

    return null;
  }

  private assertSafeSchemaIdent(schema: string): string {
    if (!/^[a-z][a-z0-9_]*$/.test(schema)) {
      throw new Error(`Nombre de schema inválido: ${schema}`);
    }
    return schema;
  }

  private async findCuentaInSchema(
    schemaName: string | null,
    codigoCuenta: string,
  ): Promise<CuentaLite | null> {
    const schema = this.assertSafeSchemaIdent(schemaName ?? 'public');
    const rows = await this.prisma.$queryRawUnsafe<CuentaLite[]>(
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

  findBodega(idBodega: string) {
    return this.findBodegaAcrossSchemas(idBodega);
  }

  private async findBodegaAcrossSchemas(idBodega: string) {
    const inPublic = await this.prisma.bodega.findUnique({
      where: { idBodega },
    });
    if (inPublic) return inPublic;

    const empresas = await this.prisma.empresa.findMany({
      where: { schemaName: { not: null } },
      select: { schemaName: true },
    });

    for (const empresa of empresas) {
      if (!empresa.schemaName) continue;
      const found = await this.findBodegaInSchema(empresa.schemaName, idBodega);
      if (found) return found;
    }

    return null;
  }

  private async findBodegaInSchema(schemaName: string, idBodega: string) {
    const schema = this.assertSafeSchemaIdent(schemaName);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        idBodega: string;
        codigoCuenta: string;
        estaActiva: boolean;
        nombre: string;
        codigo: string;
      }>
    >(
      `SELECT id_bodega AS "idBodega",
              codigo_cuenta AS "codigoCuenta",
              esta_activa AS "estaActiva",
              nombre,
              codigo
       FROM ${schema}.bodega
       WHERE id_bodega = $1::uuid
       LIMIT 1`,
      idBodega,
    );
    return rows[0] ?? null;
  }

  createUsuarioWithOptionalAsignacion(input: CreateUsuarioRecordInput) {
    return this.createUsuarioAcrossSchemas(input);
  }

  private async createUsuarioAcrossSchemas(input: CreateUsuarioRecordInput) {
    let schemaName: string | null = null;
    if (input.codigoEmpresa) {
      const empresa = await this.prisma.empresa.findUnique({
        where: { codigoEmpresa: input.codigoEmpresa },
        select: { schemaName: true },
      });
      schemaName = empresa?.schemaName ?? null;
    }

    const usuario = await this.prisma.usuario.create({
      data: {
        idAuth: input.idAuth,
        idRol: input.idRol,
        codigoEmpresa: input.codigoEmpresa,
        codigoCuenta: input.codigoCuenta,
        nombre: input.nombre.trim(),
        username: input.username.trim(),
        correo: input.correo.trim().toLowerCase(),
        telefono: input.telefono?.trim() || null,
        idCreador: input.idCreador,
        accesoWms: input.accesoWms ?? true,
        accesoMateo: input.accesoMateo ?? true,
      },
    });

    if (!input.idBodega) {
      return usuario;
    }

    try {
      // Prisma @@schema("public") ignora forSchema(); SQL calificado apunta
      // a emp_* de la empresa o a public (Tecno / legacy sin schema_name).
      await this.insertAsignacionBodega({
        schemaName,
        idUsuario: usuario.idUsuario,
        idBodega: input.idBodega,
        idRol: input.idRol,
      });
    } catch (error) {
      await this.prisma.usuario
        .delete({ where: { idUsuario: usuario.idUsuario } })
        .catch(() => undefined);
      throw this.mapAsignacionBodegaError(error);
    }

    return usuario;
  }

  private async insertAsignacionBodega(params: {
    schemaName: string | null;
    idUsuario: string;
    idBodega: string;
    idRol: WmsRol;
  }): Promise<void> {
    const schema = this.assertSafeSchemaIdent(params.schemaName ?? 'public');
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO ${schema}.asignacion_bodega (id_usuario, id_bodega, id_rol)
       VALUES ($1::uuid, $2::uuid, $3::public.wms_rol)`,
      params.idUsuario,
      params.idBodega,
      params.idRol,
    );
  }

  private mapAsignacionBodegaError(error: unknown): Error {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error);

    const isFk =
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003') ||
      message.includes('foreign key') ||
      message.includes('23503');

    if (isFk) {
      if (message.includes('bodega') || message.includes('id_bodega')) {
        return new NotFoundException(
          'La bodega no existe en el schema de la empresa',
        );
      }
      return new BadRequestException(
        'No se pudo asignar la bodega al usuario (referencia inválida)',
      );
    }

    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }
}
