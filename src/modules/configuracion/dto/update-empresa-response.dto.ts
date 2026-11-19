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

  @ApiPropertyOptional({ nullable: true, example: 'APU210325668' })
  rfc!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '601' })
  regimenFiscal!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '77560' })
  codigoPostalExpedicion!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Aguacates de Puebla' })
  nombreCuentaBancaria!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'BBVA' })
  banco!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '012528001186364430' })
  clabe!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'cobranza@aguacatesdepuebla.com',
  })
  correoCobranza!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'CS-' })
  serieFactura!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Y9IHZ/logo.jpg' })
  logoPath!: string | null;
}
