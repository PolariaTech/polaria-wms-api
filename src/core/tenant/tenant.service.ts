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

    const idBodegas = usuario.asignacionesBodega.map((a) => a.idBodega);

    if (usuario.idRol === WmsRol.configurador) {
      return {
        idUsuario: usuario.idUsuario,
        idRol: usuario.idRol,
        nivelRol: usuario.rol.nivel,
        codigoEmpresa: null,
        codigoCuenta: null,
        codigosCuentaEmpresa: [],
        idBodegas,
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

    if (usuario.codigoCuenta) {
      // cuenta puede vivir en emp_*; el include Prisma solo resuelve public.
      if (usuario.empresa.schemaName) {
        const cuentaTenant = await this.prisma
          .forSchema(usuario.empresa.schemaName)
          .cuenta.findUnique({
            where: { codigoCuenta: usuario.codigoCuenta },
            select: { estaActiva: true },
          });
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
      ? (
          await this.prisma
            .forSchema(usuario.empresa.schemaName)
            .cuenta.findMany({
              where: { codigoEmpresa: usuario.codigoEmpresa, estaActiva: true },
              select: { codigoCuenta: true },
            })
        ).map((c) => c.codigoCuenta)
      : [];

    // Bodegas / asignaciones viven en schema tenant si existe.
    const idBodegasTenant =
      usuario.empresa.schemaName != null
        ? (
            await this.prisma
              .forSchema(usuario.empresa.schemaName)
              .asignacionBodega.findMany({
                where: { idUsuario: usuario.idUsuario },
                select: { idBodega: true },
              })
          ).map((a) => a.idBodega)
        : idBodegas;

    return {
      idUsuario: usuario.idUsuario,
      idRol: usuario.idRol,
      nivelRol: usuario.rol.nivel,
      codigoEmpresa: usuario.codigoEmpresa,
      codigoCuenta: usuario.codigoCuenta,
      codigosCuentaEmpresa,
      idBodegas: idBodegasTenant,
      schemaName: usuario.empresa.schemaName,
    };
  }
}
