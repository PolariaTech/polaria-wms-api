import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class LineaEntregaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  idLineaOrdenVenta!: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  cantidadEntregada!: number;
}

export class RegistrarEntregaDto {
  @ApiProperty({ example: '49M04' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  idBodega!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  idViaje!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  idGuia!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  idOrdenVenta!: string;

  @ApiProperty()
  @IsBoolean()
  entregaConforme!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcionIncidencia?: string;

  @ApiProperty({ description: 'URL Cloudinary de la foto' })
  @IsUrl({ require_tld: false })
  evidenciaFotoUrl!: string;

  @ApiProperty({ description: 'URL Cloudinary de la firma' })
  @IsUrl({ require_tld: false })
  evidenciaFirmaUrl!: string;

  @ApiProperty({ type: [LineaEntregaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaEntregaDto)
  lineas!: LineaEntregaDto[];
}
