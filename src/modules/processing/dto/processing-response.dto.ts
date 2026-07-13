import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SolicitudProcesamientoResponseDto {
  @ApiProperty()
  idSolicitudProcesamiento!: string;

  @ApiProperty()
  codigoCuenta!: string;

  @ApiProperty()
  idBodega!: string;

  @ApiProperty()
  codigo!: string;

  @ApiPropertyOptional({ nullable: true })
  idCliente!: string | null;

  @ApiProperty()
  idProductoPrimario!: string;

  @ApiProperty()
  idProductoSecundario!: string;

  @ApiProperty()
  idSolicitante!: string;

  @ApiPropertyOptional({ nullable: true })
  idProcesador!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idOperario!: string | null;

  @ApiProperty()
  estado!: string;

  @ApiProperty()
  kilosPrimario!: string;

  @ApiPropertyOptional({ nullable: true })
  kilosSecundario!: string | null;

  @ApiPropertyOptional({ nullable: true })
  kilosMerma!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sobranteKg!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reglaConversionCantidadPrimario!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reglaConversionUnidadesSecundario!: string | null;

  @ApiPropertyOptional({ nullable: true })
  perdidaProcesamientoPct!: string | null;

  @ApiPropertyOptional({ nullable: true })
  estimadoUnidadesSecundario!: string | null;

  @ApiPropertyOptional({ nullable: true })
  kgPrimarioDescontado!: string | null;

  @ApiProperty()
  cierreDesdeProcesador!: boolean;

  @ApiPropertyOptional({ nullable: true })
  observaciones!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
