import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListMovimientosInventarioQueryDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty()
  @IsUUID()
  idBodega!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idProducto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idUbicacion?: string;

  @ApiPropertyOptional({ description: 'Tipo: recepcion, transferencia, merma, reserva' })
  @IsOptional()
  @IsString()
  tipoMovimiento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idReferencia?: string;
}

export class MovimientoInventarioResponseDto {
  @ApiProperty()
  idMovimientoInventario!: string;

  @ApiProperty()
  codigoCuenta!: string;

  @ApiProperty()
  idBodega!: string;

  @ApiPropertyOptional()
  idUbicacionOrigen!: string | null;

  @ApiPropertyOptional()
  idUbicacionDestino!: string | null;

  @ApiProperty()
  idProducto!: string;

  @ApiPropertyOptional()
  idLote!: string | null;

  @ApiProperty()
  cantidad!: string;

  @ApiProperty()
  tipoMovimiento!: string;

  @ApiProperty()
  idUsuario!: string;

  @ApiPropertyOptional()
  idReferencia!: string | null;

  @ApiPropertyOptional()
  tipoReferencia!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
