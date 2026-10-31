import { ApiProperty } from '@nestjs/swagger';

export class RegistrarSeguimientoResponseDto {
  @ApiProperty({ format: 'uuid' })
  idOrdenVenta!: string;

  @ApiProperty({ example: 'OV-00000023' })
  codigo!: string;

  @ApiProperty({ example: 'seguimiento-19c4a2.eml' })
  nombre!: string;

  @ApiProperty({ example: '023wa/b772-seguimiento-19c4a2.eml' })
  path!: string;

  @ApiProperty({
    description: 'false si ese seguimiento ya estaba en la orden.',
  })
  agregado!: boolean;
}
