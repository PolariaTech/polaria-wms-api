import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';

export class CrearPaqueteDespachoDto {
  @ApiProperty({ example: '49M04' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  idBodega!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  idCamion!: string;

  @ApiProperty({
    type: [String],
    description: 'Órdenes de venta del mismo camión / misma cuenta',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  idOrdenesVenta!: string[];
}
