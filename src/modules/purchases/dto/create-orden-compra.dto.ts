import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DestinoTipo } from '../../../generated/prisma/client';

export class OrdenCompraLineaDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  @IsUUID()
  idProducto!: string;

  @ApiProperty({ example: 100.5, minimum: 0.0001 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  cantidad!: number;

  @ApiPropertyOptional({ example: 12.5, minimum: 0, default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  precioUnitario?: number;
}

export class CreateOrdenCompraDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  idBodega!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @ValidateIf((dto: CreateOrdenCompraDto) => !dto.idSolicitudCompra)
  @IsUUID()
  idProveedor?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440100',
    description: 'Si se indica, la OC se crea desde una SOL aprobada',
  })
  @IsOptional()
  @IsUUID()
  idSolicitudCompra?: string;

  @ApiPropertyOptional({ example: '2026-07-15' })
  @IsOptional()
  @IsDateString()
  fechaEntregaEstimada?: string;

  @ApiPropertyOptional({ enum: DestinoTipo, default: DestinoTipo.interna })
  @IsOptional()
  @IsEnum(DestinoTipo)
  destinoTipo?: DestinoTipo;

  @ApiPropertyOptional({ example: 'Entrega en muelle 3' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({ type: [OrdenCompraLineaDto] })
  @ValidateIf((dto: CreateOrdenCompraDto) => !dto.idSolicitudCompra)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrdenCompraLineaDto)
  lineas?: OrdenCompraLineaDto[];
}
