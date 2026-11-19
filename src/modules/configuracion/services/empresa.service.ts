import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fichaFiscalPresente } from '../domain/empresa-ficha-fiscal';
import { CreateEmpresaDto } from '../dto/create-empresa.dto';
import { UpdateEmpresaDto } from '../dto/update-empresa.dto';
import { EmpresaRepository } from '../infrastructure/empresa.repository';
import { subirLogoEmpresa } from '../infrastructure/empresa-logo';
import type {
  CreateEmpresaResult,
  UpdateEmpresaData,
  UpdateEmpresaResult,
} from '../interfaces/empresa.interfaces';

type ArchivoLogo = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

@Injectable()
export class EmpresaService {
  constructor(private readonly empresaRepository: EmpresaRepository) {}

  async create(
    dto: CreateEmpresaDto,
    logo?: ArchivoLogo,
  ): Promise<CreateEmpresaResult> {
    const codigoEmpresa = dto.codigoEmpresa.trim();
    const razonSocial = dto.razonSocial.trim();
    this.exigirTexto(codigoEmpresa, 'El código de empresa es obligatorio');
    this.exigirTexto(razonSocial, 'La razón social es obligatoria');

    const existing = await this.empresaRepository.findByCodigo(codigoEmpresa);
    if (existing) {
      throw new ConflictException('Ya existe una empresa con ese código');
    }

    const logoPath = await this.guardarLogo(codigoEmpresa, logo, null);
    const telefonoRaw = dto.telefono?.trim() ?? '';

    return this.empresaRepository.create({
      codigoEmpresa,
      razonSocial,
      telefono: telefonoRaw.length > 0 ? telefonoRaw : null,
      idCreador: dto.idCreador?.trim() || null,
      ...fichaFiscalPresente(dto),
      ...(logoPath ? { logoPath } : {}),
    });
  }

  async update(
    codigoEmpresa: string,
    dto: UpdateEmpresaDto,
    logo?: ArchivoLogo,
  ): Promise<UpdateEmpresaResult> {
    const codigo = codigoEmpresa.trim();
    this.exigirTexto(codigo, 'El código de empresa es obligatorio');

    const existing = await this.empresaRepository.findByCodigo(codigo);
    if (!existing) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const logoPath = await this.guardarLogo(codigo, logo, existing.logoPath);
    const data = this.buildUpdateData(dto);
    if (logoPath) data.logoPath = logoPath;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar',
      );
    }

    return this.empresaRepository.update(codigo, data);
  }

  private exigirTexto(valor: string, mensaje: string): void {
    if (!valor) throw new BadRequestException(mensaje);
  }

  private async guardarLogo(
    codigoEmpresa: string,
    logo: ArchivoLogo | undefined,
    logoPathAnterior: string | null,
  ): Promise<string | null> {
    if (!logo) return null;
    const subido = await subirLogoEmpresa({
      codigoEmpresa,
      buffer: logo.buffer,
      mimetype: logo.mimetype,
      size: logo.size,
      logoPathAnterior,
    });
    if (!subido.ok) throw new BadRequestException(subido.message);
    return subido.logoPath;
  }

  private buildUpdateData(dto: UpdateEmpresaDto): UpdateEmpresaData {
    const data: UpdateEmpresaData = { ...fichaFiscalPresente(dto) };

    if (dto.razonSocial !== undefined) {
      const razonSocial = dto.razonSocial.trim();
      this.exigirTexto(razonSocial, 'La razón social es obligatoria');
      data.razonSocial = razonSocial;
    }

    if (dto.telefono !== undefined) {
      const telefono = dto.telefono?.trim() ?? '';
      data.telefono = telefono.length > 0 ? telefono : null;
    }

    if (dto.estaActiva !== undefined) {
      data.estaActiva = dto.estaActiva;
    }

    if (dto.logoPath === null) {
      data.logoPath = null;
    }

    return data;
  }
}
