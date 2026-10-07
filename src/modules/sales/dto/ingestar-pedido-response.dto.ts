import { ApiProperty } from '@nestjs/swagger';
import { PedidoExtraidoResponseDto } from './pedido-ia-response.dto';

export class IngestarPedidoResponseDto {
  @ApiProperty({ format: 'uuid' })
  idOrdenVenta!: string;

  @ApiProperty({ example: 'OV-00000023' })
  codigo!: string;

  @ApiProperty({ type: PedidoExtraidoResponseDto })
  pedido!: PedidoExtraidoResponseDto;
}
