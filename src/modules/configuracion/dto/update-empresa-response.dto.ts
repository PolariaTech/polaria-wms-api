import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmpresaResponseDto {
  @ApiProperty({ example: 'EVU53' })
  codigoEmpresa!: string;

  @ApiProperty({ example: 'Tecno SpA' })
  razonSocial!: string;

  @ApiPropertyOptional({ example: '+573001112233', nullable: true })
  telefono!: string | null;

  @ApiProperty({ example: true })
  estaActiva!: boolean;
}
