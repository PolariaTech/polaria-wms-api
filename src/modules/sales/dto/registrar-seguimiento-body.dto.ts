import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/** Multipart POST /ventas/registrar-seguimiento: cuelga un .eml en una OV ya creada. */
export class RegistrarSeguimientoBodyDto {
  @ApiProperty({ example: '023WA' })
  @IsString()
  @MinLength(1)
  codigoCuenta!: string;

  @ApiPropertyOptional({
    description:
      'Orden de compra del hotel (columna orden_compra_hotel). Obligatoria si no viene codigo.',
    example: '4501084810',
  })
  @IsOptional()
  @IsString()
  ordenCompra?: string;

  @ApiPropertyOptional({
    description: 'Código de la OV (OV-00000023). Obligatoria si no viene ordenCompra.',
    example: 'OV-00000023',
  })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional({
    description:
      'Id del mensaje (Gmail). Define el nombre seguimiento-<id>.eml y evita colgarlo dos veces.',
    example: '19c4a2f75792b1',
  })
  @IsOptional()
  @IsString()
  numeroCorreo?: string;
}
