import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BodegaTipo } from '../../../generated/prisma/client';

export class BodegaDestinoResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  idBodega!: string;

  @ApiProperty({ example: 'CTA001' })
  codigoCuenta!: string;

  @ApiProperty({ example: 'BOD-CENTRAL' })
  codigo!: string;

  @ApiProperty({ example: 'Bodega Central' })
  nombre!: string;

  @ApiProperty({ enum: BodegaTipo })
  tipo!: BodegaTipo;

  @ApiPropertyOptional({ example: 50 })
  capacidadSlots!: number | null;

  @ApiProperty({
    example: 12,
    description: 'Slots de almacenamiento libres (o capacidad declarada en externas sin layout)',
  })
  slotsLibres!: number;
}
