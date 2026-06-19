import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Username o correo del usuario',
    example: 'usuario',
  })
  @IsString()
  @IsNotEmpty()
  identificador!: string;

  @ApiPropertyOptional({
    description: 'Omitir o null para el rol configurador',
    example: 'EMP001',
  })
  @IsOptional()
  @IsString()
  codigoEmpresa?: string;

  @ApiProperty({
    description: 'Contraseña en texto plano (no se persiste en la API)',
    example: 'mi-contraseña',
    format: 'password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password!: string;
}
