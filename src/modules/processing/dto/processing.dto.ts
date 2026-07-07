import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class TenantBodegaProcesamientoQueryDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty()
  @IsUUID()
  idBodega!: string;
}

export class ListSolicitudesProcesamientoQueryDto extends TenantBodegaProcesamientoQueryDto {
  @ApiPropertyOptional({
    enum: ['borrador', 'pendiente', 'en_proceso', 'pendiente_cierre', 'terminada', 'cancelada'],
  })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idProcesador?: string;
}

export class CreateSolicitudProcesamientoDto {
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
  idCliente?: string;

  @ApiProperty()
  @IsUUID()
  idProductoPrimario!: string;

  @ApiProperty()
  @IsUUID()
  idProductoSecundario!: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  kilosPrimario!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reglaConversionCantidadPrimario?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reglaConversionUnidadesSecundario?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  perdidaProcesamientoPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class AsignarProcesadorDto extends TenantBodegaProcesamientoQueryDto {
  @ApiProperty()
  @IsUUID()
  idProcesador!: string;
}

export class CambiarEstadoProcesamientoDto extends TenantBodegaProcesamientoQueryDto {
  @ApiProperty({
    enum: ['pendiente', 'en_proceso', 'pendiente_cierre', 'terminada', 'cancelada'],
  })
  @IsEnum(['pendiente', 'en_proceso', 'pendiente_cierre', 'terminada', 'cancelada'] as const)
  estado!: 'pendiente' | 'en_proceso' | 'pendiente_cierre' | 'terminada' | 'cancelada';
}

export class CerrarSolicitudProcesamientoDto extends TenantBodegaProcesamientoQueryDto {
  @ApiProperty({ example: 450 })
  @IsNumber()
  @Min(0)
  kilosSecundario!: number;

  @ApiProperty({ example: 25 })
  @IsNumber()
  @Min(0)
  kilosMerma!: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sobranteKg?: number;
}
