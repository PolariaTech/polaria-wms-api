import { ApiProperty } from '@nestjs/swagger';

export class WarehouseStateResponseDto {
  @ApiProperty()
  idWarehouseState!: string;

  @ApiProperty()
  codigoCuenta!: string;

  @ApiProperty()
  idBodega!: string;

  @ApiProperty()
  idUbicacion!: string;

  @ApiProperty()
  idProducto!: string;

  @ApiProperty({ nullable: true })
  idLote!: string | null;

  @ApiProperty({ example: '100.0000' })
  cantidad!: string;

  @ApiProperty({ example: '0.0000' })
  cantidadReservada!: string;

  @ApiProperty({ nullable: true })
  temperatura!: string | null;

  @ApiProperty({ nullable: true })
  lockedBy!: string | null;

  @ApiProperty({ nullable: true })
  lockedAt!: Date | null;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  updatedAt!: Date;
}
