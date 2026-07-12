import { ApiProperty } from '@nestjs/swagger';

export class OrdenVentaEmitirResponseDto {
  @ApiProperty()
  idOrdenVenta!: string;

  @ApiProperty({ example: 'OV-20260709-160103' })
  venta!: string;

  @ApiProperty({ example: '49M04' })
  cuenta!: string;

  @ApiProperty({ example: 'Edgar Escobar' })
  comprador!: string;

  @ApiProperty({ example: '1 producto' })
  productos!: string;

  @ApiProperty({ example: 10 })
  cantidadKg!: number;

  @ApiProperty({ example: 10000 })
  total!: number;

  @ApiProperty({ example: 'confirmada' })
  estado!: string;

  @ApiProperty()
  fecha!: string;

  @ApiProperty({ example: 'prueba 2' })
  destino!: string;
}
