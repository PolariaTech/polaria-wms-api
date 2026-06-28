import { ApiProperty } from '@nestjs/swagger';
import {
  DestinoTipo,
  EstadoOrdenCompra,
} from '../../../generated/prisma/client';

export class OrdenCompraLineaResponseDto {
  @ApiProperty()
  idLineaOrdenCompra!: string;

  @ApiProperty()
  idProducto!: string;

  @ApiProperty({ example: '100.5000' })
  cantidad!: string;

  @ApiProperty({ example: '12.5000' })
  precioUnitario!: string;

  @ApiProperty({ example: '0.0000' })
  cantidadRecibida!: string;
}

export class OrdenCompraResponseDto {
  @ApiProperty()
  idOrdenCompra!: string;

  @ApiProperty({ example: 'CTA001' })
  codigoCuenta!: string;

  @ApiProperty()
  idBodega!: string;

  @ApiProperty()
  idProveedor!: string;

  @ApiProperty({ nullable: true })
  idSolicitudCompra!: string | null;

  @ApiProperty({ nullable: true })
  idCreador!: string | null;

  @ApiProperty({ example: 'OC-000001' })
  codigo!: string;

  @ApiProperty({ enum: EstadoOrdenCompra })
  estado!: EstadoOrdenCompra;

  @ApiProperty({ example: '2026-06-28' })
  fechaEmision!: Date;

  @ApiProperty({ nullable: true, example: '2026-07-15' })
  fechaEntregaEstimada!: Date | null;

  @ApiProperty({ enum: DestinoTipo })
  destinoTipo!: DestinoTipo;

  @ApiProperty({ nullable: true })
  observaciones!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: [OrdenCompraLineaResponseDto] })
  lineas!: OrdenCompraLineaResponseDto[];
}
