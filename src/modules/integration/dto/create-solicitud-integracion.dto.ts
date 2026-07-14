import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import type { TipoIntegracionApi } from '../constants/integration.constants';

const TIPOS_INTEGRACION = ['scraping', 'api', 'csv_plano'] as const;

export class CreateSolicitudIntegracionDto {
  @ApiPropertyOptional({
    example: 'CTA001',
    description: 'Opcional: se toma del contexto JWT del operador si se omite',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  codigoCuenta?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  bodegaExternaId!: string;

  @ApiProperty({ example: 'Bodega Externa Norte' })
  @IsString()
  @IsNotEmpty()
  bodegaExternaNombre!: string;

  @ApiProperty({ enum: TIPOS_INTEGRACION, example: 'scraping' })
  @IsEnum(TIPOS_INTEGRACION)
  tipoIntegracion!: TipoIntegracionApi;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440010' })
  @IsOptional()
  @IsUUID()
  idCliente?: string;
}
