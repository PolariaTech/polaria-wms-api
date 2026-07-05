import { ApiProperty } from '@nestjs/swagger';

export class RecepcionLineaResponseDto {
  @ApiProperty()
  idLineaRecepcion!: string;

  @ApiProperty({ nullable: true })
  idLineaOrdenCompra!: string | null;

  @ApiProperty({ nullable: true })
  idProducto!: string | null;

  @ApiProperty({ example: '100.5000' })
  cantidadRecibida!: string;

  @ApiProperty({ nullable: true, example: '-18.50' })
  temperaturaRegistrada!: string | null;

  @ApiProperty()
  esAdicional!: boolean;

  @ApiProperty({ nullable: true })
  tituloSnapshot!: string | null;
}

export class RecepcionCompraResponseDto {
  @ApiProperty()
  idRecepcion!: string;

  @ApiProperty({ example: 'CTA001' })
  codigoCuenta!: string;

  @ApiProperty()
  idBodega!: string;

  @ApiProperty()
  idOrdenCompra!: string;

  @ApiProperty()
  sinDiferencias!: boolean;

  @ApiProperty({ nullable: true })
  notas!: string | null;

  @ApiProperty()
  cerradaAt!: Date;

  @ApiProperty()
  cerradaPor!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: [RecepcionLineaResponseDto] })
  lineas!: RecepcionLineaResponseDto[];

  @ApiProperty({ example: 'recibida' })
  estadoOrdenCompra!: string;
}
