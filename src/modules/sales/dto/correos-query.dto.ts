import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const MODOS_CORREOS = ['todos', 'descartados'] as const;
export type ModoCorreos = (typeof MODOS_CORREOS)[number];

export const TAMANO_PAGINA_CORREOS_MAX = 50;

/**
 * Query de GET /ventas/correos (REQ-104). La cuenta sale del JWT: no se manda.
 * Los filtros viajan a n8n, así que la página nunca baja toda la tabla.
 */
export class CorreosQueryDto {
  @ApiPropertyOptional({
    enum: MODOS_CORREOS,
    default: 'todos',
    description:
      '`descartados` = solo los que el workflow no ingresó (`nuevo_pedido` en falso, con `motivo`).',
  })
  @IsOptional()
  @IsIn(MODOS_CORREOS)
  modo: ModoCorreos = 'todos';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({
    default: 25,
    minimum: 1,
    maximum: TAMANO_PAGINA_CORREOS_MAX,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TAMANO_PAGINA_CORREOS_MAX)
  tamano: number = 25;

  @ApiPropertyOptional({
    description: 'Desde (ISO 8601), sobre `recibido_en`.',
  })
  @IsOptional()
  @IsISO8601()
  desde?: string;

  @ApiPropertyOptional({
    description: 'Hasta (ISO 8601), sobre `recibido_en`.',
  })
  @IsOptional()
  @IsISO8601()
  hasta?: string;

  @ApiPropertyOptional({ description: 'Texto contenido en el remitente.' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  remitente?: string;

  @ApiPropertyOptional({ description: 'Texto contenido en el asunto.' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  asunto?: string;
}
