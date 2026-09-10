import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetAdministracionUsuarioPasswordDto {
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
