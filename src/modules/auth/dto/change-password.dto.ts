import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'ClaveActual1!',
    format: 'password',
    description: 'Contraseña actual del usuario autenticado',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    example: 'ClaveNueva1!',
    minLength: 8,
    format: 'password',
    description:
      'Mín. 8 caracteres, mayúscula, minúscula, número y carácter especial',
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
