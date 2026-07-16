import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import type {
  UpdateEmpresaData,
  UpdateEmpresaResult,
} from '../interfaces/empresa.interfaces';

@Injectable()
export class EmpresaRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCodigo(codigoEmpresa: string): Promise<UpdateEmpresaResult | null> {
    return this.prisma.empresa.findUnique({
      where: { codigoEmpresa },
      select: {
        codigoEmpresa: true,
        razonSocial: true,
        telefono: true,
        estaActiva: true,
      },
    });
  }

  update(
    codigoEmpresa: string,
    data: UpdateEmpresaData,
  ): Promise<UpdateEmpresaResult> {
    return this.prisma.empresa.update({
      where: { codigoEmpresa },
      data,
      select: {
        codigoEmpresa: true,
        razonSocial: true,
        telefono: true,
        estaActiva: true,
      },
    });
  }
}
