import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Body de POST /ventas/ordenes/:id/ordenes-trabajo/dividir.
 * La cuenta sale del JWT; el body solo dice qué órdenes de compra se van.
 */
export class DividirOrdenVentaBodyDto {
  @ApiProperty({
    type: [String],
    example: ['4502988746'],
    description:
      'Órdenes de compra que salen a una orden de venta nueva cada una. Al menos una debe quedarse en la actual.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((oc) => recortar({ value: oc })) : value,
  )
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(500, { each: true })
  ocSalen!: string[];
}

export class OrdenVentaNuevaDto {
  @ApiProperty() idOrdenVenta!: string;
  @ApiProperty() codigo!: string;
  @ApiProperty({ description: 'Orden de compra que quedó en esta orden.' })
  ordenCompra!: string;
}

export class DividirOrdenVentaResponseDto {
  @ApiProperty() idOrdenVenta!: string;

  @ApiProperty({ type: [OrdenVentaNuevaDto] })
  ordenesNuevas!: OrdenVentaNuevaDto[];

  @ApiProperty({
    type: [String],
    description: 'Órdenes de compra que se quedaron en la orden actual.',
  })
  ocQuedan!: string[];
}
