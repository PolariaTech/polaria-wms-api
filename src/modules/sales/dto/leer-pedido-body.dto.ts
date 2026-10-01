import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/** Campos de texto del multipart POST /ventas/leer-pedido. */
export class LeerPedidoBodyDto {
  @ApiProperty({ example: '49M04' })
  @IsString()
  @MinLength(1)
  codigoCuenta!: string;

  @ApiPropertyOptional({ example: 'Hotel Seadust' })
  @IsOptional()
  @IsString()
  cliente?: string;

  @ApiPropertyOptional({
    description: 'Mensaje pegado (opcional si hay archivos)',
  })
  @IsOptional()
  @IsString()
  texto?: string;
}
