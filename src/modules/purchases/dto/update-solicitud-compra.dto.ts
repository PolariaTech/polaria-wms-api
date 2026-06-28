import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { SolicitudCompraLineaDto } from './create-solicitud-compra.dto';

export class UpdateSolicitudCompraDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  idProveedor?: string | null;

  @ApiPropertyOptional({ example: 'Observaciones actualizadas' })
  @IsOptional()
  @IsString()
  observaciones?: string | null;

  @ApiPropertyOptional({ type: [SolicitudCompraLineaDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SolicitudCompraLineaDto)
  lineas?: SolicitudCompraLineaDto[];
}
