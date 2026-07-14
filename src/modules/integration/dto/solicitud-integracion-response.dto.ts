import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoIntegracion } from '../../../generated/prisma/client';

export class SolicitudIntegracionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  idSolicitudIntegracion!: string;

  @ApiProperty({ example: 'CTA001' })
  codigoCuenta!: string;

  @ApiPropertyOptional({ example: 'Cuenta Demo' })
  cuentaNombre?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  bodegaExternaId!: string;

  @ApiProperty({ example: 'Bodega Externa Norte' })
  bodegaNombre!: string;

  @ApiPropertyOptional({
    enum: ['scraping', 'api', 'csv_plano'],
    nullable: true,
  })
  tipoIntegracion!: string | null;

  @ApiProperty({ enum: EstadoIntegracion, example: EstadoIntegracion.activo })
  estado!: EstadoIntegracion;

  @ApiProperty({ example: '2026-06-22T12:00:00.000Z' })
  createdAt!: string;
}
