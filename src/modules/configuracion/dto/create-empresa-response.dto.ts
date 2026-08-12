import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmpresaResponseDto {
  @ApiProperty({ example: 'ANDINO' })
  codigoEmpresa!: string;

  @ApiProperty({ example: 'Andino SpA' })
  razonSocial!: string;

  @ApiPropertyOptional({ example: '+573001112233', nullable: true })
  telefono!: string | null;

  @ApiProperty({ example: true })
  estaActiva!: boolean;

  @ApiProperty({
    example: 'emp_andino',
    description: 'Schema Postgres provisionado para la empresa',
  })
  schemaName!: string;
}
