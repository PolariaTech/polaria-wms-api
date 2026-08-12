import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import type {
  CreateEmpresaData,
  CreateEmpresaResult,
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
        schemaName: true,
      },
    });
  }

  async create(data: CreateEmpresaData): Promise<CreateEmpresaResult> {
    const created = await this.prisma.empresa.create({
      data: {
        codigoEmpresa: data.codigoEmpresa,
        razonSocial: data.razonSocial,
        telefono: data.telefono ?? null,
        idCreador: data.idCreador ?? null,
        estaActiva: true,
      },
      select: {
        codigoEmpresa: true,
        razonSocial: true,
        telefono: true,
        estaActiva: true,
      },
    });

    const schemaName = await this.prisma.provisionEmpresaSchema(
      created.codigoEmpresa,
    );

    return {
      ...created,
      schemaName,
    };
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
        schemaName: true,
      },
    });
  }
}
