import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateAdministracionUsuarioDto {
  @ApiPropertyOptional({ example: 'Operador Cuenta' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ example: 'operador@empresa.com' })
  @IsOptional()
  @IsEmail()
  correo?: string;

  @ApiPropertyOptional({
    example: '+573001112233',
    nullable: true,
    description: 'Teléfono en formato internacional E.164 (opcional)',
  })
  @IsOptional()
  @IsString()
  telefono?: string | null;
}
