import { ApiProperty } from '@nestjs/swagger';

export class RegistrarEntregaResponseDto {
  @ApiProperty()
  idViaje!: string;

  @ApiProperty()
  codigoViaje!: string;

  @ApiProperty()
  idGuia!: string;

  @ApiProperty({ enum: ['ok', 'no_ok'] })
  resultado!: 'ok' | 'no_ok';

  @ApiProperty()
  estadoViaje!: string;

  @ApiProperty()
  estadoVenta!: string;
}
