import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEmpresaDto {
  @ApiProperty({ example: 'ANDINO', description: 'Código PK de la empresa' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  codigoEmpresa!: string;

  @ApiProperty({ example: 'Andino SpA' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  razonSocial!: string;

  @ApiPropertyOptional({
    example: '+573001112233',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  telefono?: string | null;

  @ApiPropertyOptional({
    description: 'id_usuario del configurador creador',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  idCreador?: string | null;
}
