import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { EstadoOrdenVenta } from '../../../generated/prisma/client';
import { TenantBodegaQueryDto } from '../../operations/dto/operations.dto';

export class ListOrdenesVentaQueryDto extends TenantBodegaQueryDto {
  @ApiPropertyOptional({ enum: EstadoOrdenVenta })
  @IsOptional()
  @IsEnum(EstadoOrdenVenta)
  estado?: EstadoOrdenVenta;

  @ApiPropertyOptional({
    description:
      'Si true, solo OVs confirmadas pendientes de registrar salida (picker del jefe)',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  paraSalida?: boolean;
}
