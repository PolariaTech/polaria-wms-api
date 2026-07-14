import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecepcionLineaDto {
  @ApiProperty()
  @IsUUID()
  idLineaOrdenCompra!: string;

  @ApiProperty({ example: 100.5 })
  @IsNumber()
  @Min(0)
  cantidadRecibida!: number;

  @ApiPropertyOptional({ example: -18.5 })
  @IsOptional()
  @IsNumber()
  temperaturaRegistrada?: number;
}

export class RecepcionLineaAdicionalDto {
  @ApiProperty()
  @IsUUID()
  idProducto!: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0)
  cantidadRecibida!: number;

  @ApiPropertyOptional({ example: -20 })
  @IsOptional()
  @IsNumber()
  temperaturaRegistrada?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tituloSnapshot?: string;
}

export class CreateRecepcionCompraDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty()
  @IsUUID()
  idBodega!: string;

  @ApiProperty({
    description: 'Líneas recibidas contra la OC (conciliación ciega)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecepcionLineaDto)
  lineas!: RecepcionLineaDto[];

  @ApiPropertyOptional({ description: 'Productos no pedidos en la OC' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecepcionLineaAdicionalDto)
  lineasAdicionales?: RecepcionLineaAdicionalDto[];

  @ApiPropertyOptional({
    description:
      'Slot de zona ingreso; si se indica, crea warehouse_state y movimiento',
  })
  @IsOptional()
  @IsUUID()
  idUbicacionIngreso?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}
