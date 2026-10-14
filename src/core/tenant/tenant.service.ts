import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WmsRol } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { TenantContext } from './tenant-context.interface';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async buildContext(
    idAuth: string,
    requestedCodigoEmpresa?: string,
  ): Promise<TenantContext> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { idAuth, estaActivo: true },
      include: {
        rol: true,
        empresa: true,
        cuenta: true,
        asignacionesBodega: { select: { idBodega: true } },
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado o inactivo');
    }

    const idBodegasPublic = usuario.asignacionesBodega.map((a) => a.idBodega);

    if (usuario.idRol === WmsRol.configurador) {
      return {
        idUsuario: usuario.idUsuario,
        idRol: usuario.idRol,
        nivelRol: usuario.rol.nivel,
        codigoEmpresa: null,
        codigoCuenta: null,
        codigosCuentaEmpresa: [],
        idBodegas: idBodegasPublic,
        schemaName: null,
      };
    }

    if (!usuario.codigoEmpresa) {
      throw new ForbiddenException('Usuario sin empresa asignada');
    }

    if (!usuario.empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    if (!usuario.empresa.estaActiva) {
      throw new ForbiddenException('La empresa está inactiva');
    }

    const schemaName = usuario.empresa.schemaName;
    const schema = this.resolveSchemaIdent(schemaName);

    if (usuario.codigoCuenta) {
      // cuenta puede vivir en emp_*; el include Prisma solo resuelve public.
      if (schemaName) {
        const cuentaTenant = await this.findCuentaActivaInSchema(
          schema,
          usuario.codigoCuenta,
        );
        if (cuentaTenant && !cuentaTenant.estaActiva) {
          throw new ForbiddenException('La cuenta está inactiva');
        }
      } else if (usuario.cuenta && !usuario.cuenta.estaActiva) {
        throw new ForbiddenException('La cuenta está inactiva');
      }
    }

    const codigoEmpresaSolicitado = requestedCodigoEmpresa?.trim();
    if (
      codigoEmpresaSolicitado &&
      usuario.codigoEmpresa !== codigoEmpresaSolicitado
    ) {
      throw new ForbiddenException(
        'El usuario no pertenece a la empresa indicada',
      );
    }

    const codigosCuentaEmpresa = usuario.codigoEmpresa
      ? await this.listCodigosCuentaEmpresa(schema, usuario.codigoEmpresa)
      : [];

    // Bodegas / asignaciones: emp_* si hay schema; public solo Tecno/legacy.
    const idBodegas =
      schemaName != null
        ? await this.listIdBodegasAsignacion(schema, usuario.idUsuario)
        : idBodegasPublic;

    return {
      idUsuario: usuario.idUsuario,
      idRol: usuario.idRol,
      nivelRol: usuario.rol.nivel,
      codigoEmpresa: usuario.codigoEmpresa,
      codigoCuenta: usuario.codigoCuenta,
      codigosCuentaEmpresa,
      idBodegas,
      schemaName,
    };
  }

  private resolveSchemaIdent(schemaName: string | null): string {
    const schema = schemaName ?? 'public';
    if (!/^[a-z][a-z0-9_]*$/.test(schema)) {
      throw new Error(`Nombre de schema inválido: ${schema}`);
    }
    return schema;
  }

  private async findCuentaActivaInSchema(
    schema: string,
    codigoCuenta: string,
  ): Promise<{ estaActiva: boolean } | null> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ estaActiva: boolean }>
    >(
      `SELECT esta_activa AS "estaActiva"
         FROM ${schema}.cuenta
        WHERE codigo_cuenta = $1
        LIMIT 1`,
      codigoCuenta,
    );
    return rows[0] ?? null;
  }

  private async listCodigosCuentaEmpresa(
    schema: string,
    codigoEmpresa: string,
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ codigoCuenta: string }>
    >(
      `SELECT codigo_cuenta AS "codigoCuenta"
         FROM ${schema}.cuenta
        WHERE codigo_empresa = $1
          AND esta_activa = true`,
      codigoEmpresa,
    );
    return rows.map((row) => row.codigoCuenta);
  }

  private async listIdBodegasAsignacion(
    schema: string,
    idUsuario: string,
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ idBodega: string }>
    >(
      `SELECT id_bodega AS "idBodega"
         FROM ${schema}.asignacion_bodega
        WHERE id_usuario = $1::uuid
          AND esta_activa = true`,
      idUsuario,
    );
    return rows.map((row) => row.idBodega);
  }
}
