import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoSolicitudCompra } from '../../../generated/prisma/client';

export class ListSolicitudesQueryDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  idBodega?: string;

  @ApiPropertyOptional({ enum: EstadoSolicitudCompra })
  @IsOptional()
  @IsEnum(EstadoSolicitudCompra)
  estado?: EstadoSolicitudCompra;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  idProveedor?: string;
}
