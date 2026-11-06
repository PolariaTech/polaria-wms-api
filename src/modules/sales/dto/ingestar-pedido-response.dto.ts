import { ApiProperty } from '@nestjs/swagger';
import { PedidoExtraidoResponseDto } from './pedido-ia-response.dto';

export class OrdenIngestadaDto {
  @ApiProperty({ format: 'uuid' })
  idOrdenVenta!: string;

  @ApiProperty({ example: 'OV-00000023' })
  codigo!: string;
}

export class IngestarPedidoResponseDto {
  @ApiProperty({ format: 'uuid' })
  idOrdenVenta!: string;

  @ApiProperty({ example: 'OV-00000023' })
  codigo!: string;

  @ApiProperty({ type: PedidoExtraidoResponseDto })
  pedido!: PedidoExtraidoResponseDto;

  @ApiProperty({
    type: [OrdenIngestadaDto],
    description:
      'Una OV por fecha de entrega. Si el correo trae un solo día, es un solo elemento. idOrdenVenta y codigo repiten el primero.',
  })
  ordenes!: OrdenIngestadaDto[];
}
