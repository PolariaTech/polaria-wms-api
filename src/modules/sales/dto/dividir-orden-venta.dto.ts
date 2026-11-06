import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CRITERIOS_DIVISION } from '../ai/utils/claves-division';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Body de POST /ventas/ordenes/:id/ordenes-trabajo/dividir.
 * La cuenta sale del JWT; el body solo dice por qué criterio se divide y qué valores se van.
 */
export class DividirOrdenVentaBodyDto {
  @ApiProperty({
    enum: CRITERIOS_DIVISION,
    example: 'oc',
    description: 'Orden de compra, día de entrega u horario de entrega.',
  })
  @IsIn(CRITERIOS_DIVISION)
  criterio!: (typeof CRITERIOS_DIVISION)[number];

  @ApiProperty({
    type: [String],
    example: ['4502988746'],
    description:
      'Valores del criterio que salen a una orden de venta nueva cada uno. Al menos uno debe quedarse en la actual.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((valor) => recortar({ value: valor })) : value,
  )
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(500, { each: true })
  valoresSalen!: string[];
}

export class OrdenVentaNuevaDto {
  @ApiProperty() idOrdenVenta!: string;
  @ApiProperty() codigo!: string;
  @ApiProperty({ description: 'Valor del criterio que quedó en esta orden.' })
  valor!: string;
}

export class DividirOrdenVentaResponseDto {
  @ApiProperty() idOrdenVenta!: string;

  @ApiProperty({ enum: CRITERIOS_DIVISION })
  criterio!: (typeof CRITERIOS_DIVISION)[number];

  @ApiProperty({ type: [OrdenVentaNuevaDto] })
  ordenesNuevas!: OrdenVentaNuevaDto[];

  @ApiProperty({
    type: [String],
    description: 'Valores que se quedaron juntos en la orden actual.',
  })
  valoresQuedan!: string[];
}
