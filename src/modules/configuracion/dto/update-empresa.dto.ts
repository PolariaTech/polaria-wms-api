import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateEmpresaDto {
  @ApiPropertyOptional({ example: 'Tecno SpA' })
  @IsOptional()
  @IsString()
  razonSocial?: string;

  @ApiPropertyOptional({
    example: '+573001112233',
    nullable: true,
    description: 'Teléfono internacional. Enviar null o string vacío para limpiar.',
  })
  @IsOptional()
  @IsString()
  telefono?: string | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Estado activo/inactivo de la empresa',
  })
  @IsOptional()
  @IsBoolean()
  estaActiva?: boolean;
}
