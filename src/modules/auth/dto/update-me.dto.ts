import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateMeDto {
  @ApiProperty({ example: 'Nombre Apellido', maxLength: 255 })
  @Transform(({ value }: { value: unknown }): string =>
    typeof value === 'string' ? value.trim() : '',
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nombre!: string;

  @ApiPropertyOptional({
    example: '+573001112233',
    nullable: true,
    description: 'Teléfono E.164 del perfil. Único entre usuarios. Enviar null o vacío para quitarlo.',
  })
  @Transform(({ value }: { value: unknown }): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(32)
  telefono?: string | null;
}
