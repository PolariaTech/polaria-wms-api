import { ApiProperty } from '@nestjs/swagger';

export class BootstrapLayoutResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  idBodega!: string;

  @ApiProperty({ example: 'CTA001' })
  codigoCuenta!: string;

  @ApiProperty({
    example: 50,
    description: 'Capacidad efectiva aplicada (1–500)',
  })
  capacidadSlots!: number;

  @ApiProperty({ example: 4 })
  tiposUbicacionCreados!: number;

  @ApiProperty({ example: 4 })
  zonasCreadas!: number;

  @ApiProperty({
    example: 32,
    description: '8 ingreso + N almacén + 8 salida + 4 procesamiento',
  })
  ubicacionesCreadas!: number;
}
