import { Injectable } from '@nestjs/common';
import { WmsRol } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

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
}

@Injectable()
export class ConfiguradorUsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string) {
    return this.prisma.usuario.findUnique({
      where: { username: username.trim() },
    });
  }

  findByCorreo(correo: string) {
    return this.prisma.usuario.findUnique({
      where: { correo: correo.trim().toLowerCase() },
    });
  }

  findRol(idRol: WmsRol) {
    return this.prisma.rol.findUnique({ where: { idRol } });
  }

  findCuentaWithEmpresa(codigoCuenta: string) {
    return this.prisma.cuenta.findUnique({
      where: { codigoCuenta },
      include: { empresa: true },
    });
  }

  findBodega(idBodega: string) {
    return this.prisma.bodega.findUnique({ where: { idBodega } });
  }

  createUsuarioWithOptionalAsignacion(input: CreateUsuarioRecordInput) {
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
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
        },
      });

      if (input.idBodega) {
        await tx.asignacionBodega.create({
          data: {
            idUsuario: usuario.idUsuario,
            idBodega: input.idBodega,
            idRol: input.idRol,
          },
        });
      }

      return usuario;
    });
  }
}
