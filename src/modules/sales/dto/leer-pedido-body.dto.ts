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

  @ApiPropertyOptional({
    description:
      'Id del mensaje de correo (Gmail/hash). Se sella en cada renglón origenCorreo.',
    example: '1a118678f75792b1',
  })
  @IsOptional()
  @IsString()
  numeroCorreo?: string;

  @ApiPropertyOptional({
    description:
      'Timestamp de ingestión (YYYY-MM-DD HH:mm:ss). Default: ahora.',
    example: '2026-10-07 17:06:26',
  })
  @IsOptional()
  @IsString()
  horario?: string;
}
