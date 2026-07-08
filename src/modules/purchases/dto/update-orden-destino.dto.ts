import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DestinoTipo } from '../../../generated/prisma/client';

export class UpdateOrdenDestinoDto {
  @ApiProperty({ enum: DestinoTipo, example: DestinoTipo.interna })
  @IsEnum(DestinoTipo)
  destinoTipo!: DestinoTipo;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  idBodega!: string;

  @ApiPropertyOptional({ example: '2026-07-15' })
  @IsOptional()
  @IsDateString()
  fechaEntregaEstimada?: string;
}
