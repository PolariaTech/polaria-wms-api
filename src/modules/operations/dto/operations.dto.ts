import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import type { FlujoOrdenTrabajo } from '../interfaces/operations.interfaces';

export class TenantBodegaQueryDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty()
  @IsUUID()
  idBodega!: string;
}

export class ListOrdenesTrabajoQueryDto extends TenantBodegaQueryDto {
  @ApiPropertyOptional({
    enum: ['planificada', 'en_proceso', 'pausada', 'completada', 'cancelada'],
  })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiPropertyOptional({
    enum: [
      'a_bodega',
      'a_salida',
      'revisar',
      'bodega_a_bodega',
      'a_procesamiento',
    ],
  })
  @IsOptional()
  @IsEnum([
    'a_bodega',
    'a_salida',
    'revisar',
    'bodega_a_bodega',
    'a_procesamiento',
  ] as const)
  tipoFlujo?: FlujoOrdenTrabajo;
}

export class CreateOrdenTrabajoDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty()
  @IsUUID()
  idBodega!: string;

  @ApiProperty({
    enum: [
      'a_bodega',
      'a_salida',
      'revisar',
      'bodega_a_bodega',
      'a_procesamiento',
    ],
  })
  @IsEnum([
    'a_bodega',
    'a_salida',
    'revisar',
    'bodega_a_bodega',
    'a_procesamiento',
  ] as const)
  tipoFlujo!: FlujoOrdenTrabajo;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idUbicacionOrigen?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idUbicacionDestino?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idLote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idProducto?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidad?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idAsignado?: string;

  @ApiPropertyOptional({
    description: 'OV vinculada (salida manual desde venta)',
  })
  @IsOptional()
  @IsUUID()
  idOrdenVenta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class EjecutarOrdenTrabajoDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty()
  @IsUUID()
  idBodega!: string;

  @ApiPropertyOptional({
    description: 'Posición warehouse_state a mover (opcional en revisar)',
  })
  @IsOptional()
  @IsUUID()
  idWarehouseState?: string;

  @ApiPropertyOptional({
    description: 'Versión optimistic lock de warehouse_state',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class ReportarOrdenTrabajoDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty()
  @IsUUID()
  idBodega!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  titulo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class ListTareasQueryDto extends TenantBodegaQueryDto {
  @ApiPropertyOptional({
    enum: ['pendiente', 'en_proceso', 'completada', 'cancelada'],
  })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idAsignado?: string;
}

export class AsignarTareaDto {
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
  idAsignado?: string;
}

export class TenantBodegaBodyDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty()
  @IsUUID()
  idBodega!: string;
}

export class ListAlertasQueryDto extends TenantBodegaQueryDto {
  @ApiPropertyOptional({ enum: ['abierta', 'cerrada'] })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiPropertyOptional({
    enum: ['temperatura', 'demora', 'orden_reportada', 'otro'],
  })
  @IsOptional()
  @IsString()
  tipo?: string;
}

export class CreateAlertaDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty()
  @IsUUID()
  idBodega!: string;

  @ApiProperty({ enum: ['temperatura', 'demora', 'orden_reportada', 'otro'] })
  @IsString()
  @IsNotEmpty()
  tipo!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  titulo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idUbicacion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idOrdenTrabajo?: string;
}

export class AsignarAlertaDto extends TenantBodegaBodyDto {
  @ApiProperty()
  @IsUUID()
  idResponsable!: string;
}

export class CerrarAlertaDto extends TenantBodegaBodyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivoCierre?: string;
}

export class CrearLlamadaDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty()
  @IsUUID()
  idBodega!: string;

  @ApiPropertyOptional({ example: 'Llamado del operario' })
  @IsOptional()
  @IsString()
  message?: string;
}
