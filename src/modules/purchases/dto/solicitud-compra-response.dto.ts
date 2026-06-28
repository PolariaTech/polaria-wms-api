import { ApiProperty } from '@nestjs/swagger';
import { EstadoSolicitudCompra } from '../../../generated/prisma/client';

export class SolicitudCompraLineaResponseDto {
  @ApiProperty()
  idLineaSolicitudCompra!: string;

  @ApiProperty()
  idProducto!: string;

  @ApiProperty({ example: '100.5000' })
  cantidad!: string;
}

export class SolicitudCompraResponseDto {
  @ApiProperty()
  idSolicitudCompra!: string;

  @ApiProperty({ example: 'CTA001' })
  codigoCuenta!: string;

  @ApiProperty()
  idBodega!: string;

  @ApiProperty({ nullable: true })
  idProveedor!: string | null;

  @ApiProperty({ nullable: true })
  idOrdenCompra!: string | null;

  @ApiProperty({ example: 'SOL-000001' })
  codigo!: string;

  @ApiProperty({ enum: EstadoSolicitudCompra })
  estado!: EstadoSolicitudCompra;

  @ApiProperty()
  idSolicitante!: string;

  @ApiProperty({ nullable: true })
  observaciones!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: [SolicitudCompraLineaResponseDto] })
  lineas!: SolicitudCompraLineaResponseDto[];
}
