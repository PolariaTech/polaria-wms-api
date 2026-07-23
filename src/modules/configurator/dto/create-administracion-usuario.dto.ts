import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { WmsRol } from '../../../generated/prisma/client';

export class CreateAdministracionUsuarioDto {
  @ApiProperty({ example: 'operario.bodega1' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'Operario Bodega 1' })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiPropertyOptional({
    enum: WmsRol,
    example: WmsRol.operador_cuenta,
    description:
      'Opcional. Por defecto operador_cuenta cuando el admin asigna usuarios de cuenta.',
  })
  @IsOptional()
  @IsEnum(WmsRol)
  idRol?: WmsRol;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Obligatorio para roles de nivel bodega',
  })
  @IsOptional()
  @IsUUID()
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
