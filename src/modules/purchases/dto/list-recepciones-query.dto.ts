import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListRecepcionesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idBodega?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idOrdenCompra?: string;
}
