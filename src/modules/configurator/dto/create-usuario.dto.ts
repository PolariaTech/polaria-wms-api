import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { WmsRol } from '../../../generated/prisma/client';

export class CreateUsuarioDto {
  @ApiProperty({ example: 'operario.bodega1' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'Operario Bodega 1' })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiProperty({ enum: WmsRol, example: WmsRol.operario })
  @IsEnum(WmsRol)
  idRol!: WmsRol;

  @ApiPropertyOptional({ example: 'CTA001' })
  @IsOptional()
  @IsString()
  codigoCuenta?: string;

  @ApiPropertyOptional({ example: 'EMP001' })
  @IsOptional()
  @IsString()
  codigoEmpresa?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Obligatorio para roles de nivel bodega',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idBodega?: string;

  @ApiProperty({ example: 'operario@empresa.com' })
  @IsEmail()
  correo!: string;

  @ApiPropertyOptional({
    example: '+573001112233',
    description: 'Teléfono en formato internacional E.164 (opcional)',
  })
  @IsOptional()
  @IsString()
  telefono?: string | null;

  @ApiProperty({
    example: 'ClaveSegura1!',
    minLength: 8,
    description:
      'Mín. 8 caracteres, mayúscula, minúscula, número y carácter especial',
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
