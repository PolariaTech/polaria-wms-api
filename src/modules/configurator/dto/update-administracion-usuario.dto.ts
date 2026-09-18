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
    description: 'Teléfono E.164 del perfil. Único entre usuarios. Opcional.',
  })
  @IsOptional()
  @IsString()
  telefono?: string | null;
}
