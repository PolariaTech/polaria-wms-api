import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PreloginDto {
  @ApiProperty({
    description: 'Username o correo del usuario',
    example: 'usuario',
  })
  @IsString()
  @IsNotEmpty()
  identificador!: string;

  @ApiPropertyOptional({
    description:
      'Código de empresa. Obligatorio para roles distintos de configurador',
    example: 'EMP001',
  })
  @IsOptional()
  @IsString()
  codigoEmpresa?: string;
}
