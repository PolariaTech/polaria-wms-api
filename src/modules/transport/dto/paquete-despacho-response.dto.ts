import { ApiProperty } from '@nestjs/swagger';

export class GuiaPaqueteDespachoDto {
  @ApiProperty()
  idGuia!: string;

  @ApiProperty()
  codigo!: string;

  @ApiProperty()
  idOrdenVenta!: string;

  @ApiProperty()
  codigoVenta!: string;
}

export class PaqueteDespachoResponseDto {
  @ApiProperty()
  idViaje!: string;

  @ApiProperty()
  codigoViaje!: string;

  @ApiProperty()
  idCamion!: string;

  @ApiProperty()
  placaCamion!: string;

  @ApiProperty({ type: [GuiaPaqueteDespachoDto] })
  guias!: GuiaPaqueteDespachoDto[];
}
