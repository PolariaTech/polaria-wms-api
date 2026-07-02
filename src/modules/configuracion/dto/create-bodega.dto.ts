import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { BodegaTipo } from '../../../generated/prisma/client';
import {
  LAYOUT_MAX_SLOTS,
  LAYOUT_MIN_SLOTS,
} from '../constants/warehouse-layout.constants';

export class CreateBodegaDto {
  @ApiProperty({
    example: 'CTA001',
    description: 'Cuenta destino de la bodega',
  })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty({
    example: 'BOD-CENTRAL',
    description: 'Código único dentro de la cuenta',
  })
  @IsString()
  @IsNotEmpty()
  codigo!: string;

  @ApiProperty({ example: 'Bodega Central' })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiProperty({ enum: BodegaTipo, example: BodegaTipo.interna })
  @IsEnum(BodegaTipo)
  tipo!: BodegaTipo;

  @ApiPropertyOptional({
    example: 50,
    minimum: LAYOUT_MIN_SLOTS,
    maximum: LAYOUT_MAX_SLOTS,
    description: 'Capacidad de slots. Obligatoria para bodegas internas.',
  })
  @IsOptional()
  @IsInt()
  @Min(LAYOUT_MIN_SLOTS)
  @Max(LAYOUT_MAX_SLOTS)
  capacidadSlots?: number;
}
