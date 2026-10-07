import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { LeerPedidoBodyDto } from './leer-pedido-body.dto';

/** Multipart POST /ventas/ingestar-pedido: leer + crear OV por_confirmar. */
export class IngestarPedidoBodyDto extends LeerPedidoBodyDto {
  @ApiPropertyOptional({
    description:
      'Bodega de la OV (uuid). Si se omite: bodega default de la cuenta o la primera activa.',
    example: 'ea4c3051-b034-4b62-b79f-f35e68615cf3',
  })
  @IsOptional()
  @IsUUID()
  idBodega?: string;

  @ApiPropertyOptional({
    description: 'Nombre de archivo(s) para origen_archivos (texto libre).',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  origenArchivos?: string;
}
