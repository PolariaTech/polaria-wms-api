import { ApiProperty } from '@nestjs/swagger';

export class EnsureOperationalZonesResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  idBodega!: string;

  @ApiProperty({ example: 'CTA001' })
  codigoCuenta!: string;

  @ApiProperty({ example: 2 })
  tiposUbicacionCreados!: number;

  @ApiProperty({ example: 3 })
  zonasCreadas!: number;

  @ApiProperty({ example: 8 })
  ubicacionesIngresoCreadas!: number;

  @ApiProperty({ example: 8 })
  ubicacionesSalidaCreadas!: number;

  @ApiProperty({ example: 4 })
  ubicacionesProcesamientoCreadas!: number;
}
