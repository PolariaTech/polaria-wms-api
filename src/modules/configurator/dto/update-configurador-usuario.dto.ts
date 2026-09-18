import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateConfiguradorUsuarioDto {
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

  @ApiPropertyOptional({
    example: true,
    description: 'Si es false, este usuario no puede iniciar sesión.',
  })
  @IsOptional()
  @IsBoolean()
  estaActivo?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Si es true, este usuario opera Polaria WMS.',
  })
  @IsOptional()
  @IsBoolean()
  accesoWms?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Si es true, este usuario puede entrar a Mateo IA.',
  })
  @IsOptional()
  @IsBoolean()
  accesoMateo?: boolean;
}
