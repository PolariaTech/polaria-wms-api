import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RechazarSolicitudDto {
  @ApiPropertyOptional({ example: 'Presupuesto insuficiente' })
  @IsOptional()
  @IsString()
  motivo?: string;
}
