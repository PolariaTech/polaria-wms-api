import { Injectable } from '@nestjs/common';
import { WmsRol } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

export type UsuarioWithRelations = Awaited<
  ReturnType<UsuarioRepository['findActiveByIdentificador']>
> extends infer U
  ? Exclude<U, null>
  : never;

@Injectable()
export class UsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly activeInclude = {
    rol: true,
    empresa: true,
    cuenta: true,
    asignacionesBodega: { select: { idBodega: true } },
  } as const;

  findActiveByIdentificador(identificador: string) {
    const normalized = identificador.trim();

    return this.prisma.usuario.findFirst({
      where: {
        estaActivo: true,
        OR: [{ username: normalized }, { correo: normalized }],
      },
      include: this.activeInclude,
    });
  }

  findActiveByUsername(username: string) {
    return this.prisma.usuario.findFirst({
      where: {
        estaActivo: true,
        username: username.trim(),
      },
      include: this.activeInclude,
    });
  }

  findActiveByCorreo(correo: string) {
    return this.prisma.usuario.findFirst({
      where: {
        estaActivo: true,
        correo: correo.trim(),
      },
      include: this.activeInclude,
    });
  }

  findActiveByIdAuth(idAuth: string) {
    return this.prisma.usuario.findFirst({
      where: {
        idAuth,
        estaActivo: true,
      },
      include: this.activeInclude,
    });
  }

  findActiveByIdUsuario(idUsuario: string) {
    return this.prisma.usuario.findFirst({
      where: {
        idUsuario,
        estaActivo: true,
      },
      include: this.activeInclude,
    });
  }

  isConfigurador(idRol: WmsRol | string): boolean {
    return idRol === WmsRol.configurador;
  }
}
