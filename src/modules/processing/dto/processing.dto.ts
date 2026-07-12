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

  @ApiPropertyOptional({ description: 'Kg merma al pasar a pendiente_cierre' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  desperdicioKg?: number;
}

export class CerrarSolicitudProcesamientoDto extends TenantBodegaProcesamientoQueryDto {
  @ApiPropertyOptional({
    example: 450,
    description: 'Unidades secundario; si se omite, usa floor(estimado)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kilosSecundario?: number;

  @ApiProperty({ example: 25, description: 'Kg merma operativa (desperdicioKg frio)' })
  @IsNumber()
  @Min(0)
  kilosMerma!: number;
}

export class AsignarOperarioDto extends TenantBodegaProcesamientoQueryDto {
  @ApiProperty()
  @IsUUID()
  idOperario!: string;
}

export class IniciarProcesamientoDto extends TenantBodegaProcesamientoQueryDto {
  @ApiPropertyOptional({ description: 'Procesador a asignar al pasar a en curso' })
  @IsOptional()
  @IsUUID()
  idProcesador?: string;
}

export class CreateOrdenesPostCierreDto extends TenantBodegaProcesamientoQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idUbicacionDestinoProcesado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idUbicacionDestinoDesperdicio?: string;
}
