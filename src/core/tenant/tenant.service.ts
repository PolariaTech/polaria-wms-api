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
        idBodegas,
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

    if (usuario.codigoCuenta && usuario.cuenta && !usuario.cuenta.estaActiva) {
      throw new ForbiddenException('La cuenta está inactiva');
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

    return {
      idUsuario: usuario.idUsuario,
      idRol: usuario.idRol,
      nivelRol: usuario.rol.nivel,
      codigoEmpresa: usuario.codigoEmpresa,
      codigoCuenta: usuario.codigoCuenta,
      idBodegas,
    };
  }
}
