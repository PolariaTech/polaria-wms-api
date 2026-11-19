import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { EmpresaFichaFiscalDto } from './empresa-ficha-fiscal.dto';

export class UpdateEmpresaDto extends EmpresaFichaFiscalDto {
  @ApiPropertyOptional({ example: 'Tecno SpA' })
  @IsOptional()
  @IsString()
  razonSocial?: string;

  @ApiPropertyOptional({
    example: '+573001112233',
    nullable: true,
    description:
      'Teléfono internacional. Enviar null o string vacío para limpiar.',
  })
  @IsOptional()
  @IsString()
  telefono?: string | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Estado activo/inactivo de la empresa',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  estaActiva?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Enviar null para quitar el logo guardado.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === '' || value === 'null' ? null : undefined,
  )
  logoPath?: string | null;
}
