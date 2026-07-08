import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DestinoTipo } from '../../../generated/prisma/client';

export class ListBodegasDestinoQueryDto {
  @ApiProperty({ example: 'CTA001' })
  @IsString()
  @IsNotEmpty()
  codigoCuenta!: string;

  @ApiProperty({ enum: DestinoTipo, example: DestinoTipo.interna })
  @IsEnum(DestinoTipo)
  tipo!: DestinoTipo;
}
