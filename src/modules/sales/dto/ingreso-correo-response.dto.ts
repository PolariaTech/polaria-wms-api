import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ESTADOS_INGRESO_CORREO = [
  'procesando',
  'ingresado',
  'error',
] as const;
export type EstadoIngresoCorreo = (typeof ESTADOS_INGRESO_CORREO)[number];

/** Estado del ingreso manual de un correo como OV (POST …/ingresar y GET …/ingreso). */
export class IngresoCorreoResponseDto {
  @ApiProperty({ example: '1a1a198510cde156' })
  messageId!: string;

  @ApiProperty({ enum: ESTADOS_INGRESO_CORREO })
  estado!: EstadoIngresoCorreo;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  idOrdenVenta!: string | null;

  @ApiPropertyOptional({ example: 'OV-00000023', nullable: true })
  codigoOrdenVenta!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Motivo del fallo cuando `estado` es `error`; se puede reintentar.',
  })
  error!: string | null;
}
