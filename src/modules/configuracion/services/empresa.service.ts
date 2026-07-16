import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateEmpresaDto } from '../dto/update-empresa.dto';
import { EmpresaRepository } from '../infrastructure/empresa.repository';
import type {
  UpdateEmpresaData,
  UpdateEmpresaResult,
} from '../interfaces/empresa.interfaces';

@Injectable()
export class EmpresaService {
  constructor(private readonly empresaRepository: EmpresaRepository) {}

  async update(
    codigoEmpresa: string,
    dto: UpdateEmpresaDto,
  ): Promise<UpdateEmpresaResult> {
    const codigo = codigoEmpresa.trim();
    if (!codigo) {
      throw new BadRequestException('El código de empresa es obligatorio');
    }

    const data = this.buildUpdateData(dto);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar',
      );
    }

    const existing = await this.empresaRepository.findByCodigo(codigo);
    if (!existing) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return this.empresaRepository.update(codigo, data);
  }

  private buildUpdateData(dto: UpdateEmpresaDto): UpdateEmpresaData {
    const data: UpdateEmpresaData = {};

    if (dto.razonSocial !== undefined) {
      const razonSocial = dto.razonSocial.trim();
      if (!razonSocial) {
        throw new BadRequestException('La razón social es obligatoria');
      }
      data.razonSocial = razonSocial;
    }

    if (dto.telefono !== undefined) {
      const telefono = dto.telefono?.trim() ?? '';
      data.telefono = telefono.length > 0 ? telefono : null;
    }

    if (dto.estaActiva !== undefined) {
      data.estaActiva = dto.estaActiva;
    }

    return data;
  }
}
