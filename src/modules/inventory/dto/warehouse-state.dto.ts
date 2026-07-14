import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class LockWarehouseStateDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty()
  @IsUUID()
  idBodega!: string;

  @ApiPropertyOptional({
    description:
      'Control optimista; debe coincidir con warehouse_state.version',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

export class ListWarehouseStateQueryDto {
  @ApiProperty()
  @IsUUID()
  idBodega!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idUbicacion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idProducto?: string;
}
