import { ApiProperty } from '@nestjs/swagger';

export class BodegaReportesResumenDto {
  @ApiProperty()
  ingresos!: number;

  @ApiProperty()
  salidas!: number;

  @ApiProperty()
  movimientos!: number;

  @ApiProperty()
  despachados!: number;

  @ApiProperty()
  alertas!: number;

  @ApiProperty()
  mermaKg!: number;

  @ApiProperty()
  ordenesTrabajoPendientes!: number;

  @ApiProperty()
  tareasPendientes!: number;

  @ApiProperty()
  llamadasPendientes!: number;
}
