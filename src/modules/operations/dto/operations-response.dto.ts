import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrdenTrabajoLineaResponseDto {
  @ApiProperty()
  idLineaOrdenTrabajo!: string;

  @ApiProperty()
  idProducto!: string;

  @ApiPropertyOptional({ nullable: true })
  idUbicacion!: string | null;

  @ApiProperty()
  tipoLinea!: string;

  @ApiProperty()
  cantidad!: string;
}

export class OrdenTrabajoResponseDto {
  @ApiProperty()
  idOrdenTrabajo!: string;

  @ApiProperty()
  codigoCuenta!: string;

  @ApiProperty()
  idBodega!: string;

  @ApiProperty()
  codigo!: string;

  @ApiProperty()
  estado!: string;

  @ApiProperty()
  tipo!: string;

  @ApiPropertyOptional({ enum: ['a_bodega', 'a_salida', 'revisar'], nullable: true })
  tipoFlujo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idAsignado!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idSolicitante!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idLote!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idUbicacionOrigen!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idUbicacionDestino!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idSolicitudProcesamiento!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idOrdenVenta!: string | null;

  @ApiPropertyOptional({ nullable: true })
  observaciones!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: [OrdenTrabajoLineaResponseDto] })
  lineas!: OrdenTrabajoLineaResponseDto[];
}

export class TareaColaResponseDto {
  @ApiProperty()
  idTarea!: string;

  @ApiProperty()
  codigoCuenta!: string;

  @ApiProperty()
  idBodega!: string;

  @ApiProperty()
  tipo!: string;

  @ApiProperty()
  estado!: string;

  @ApiPropertyOptional({ nullable: true })
  idAsignado!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idOrdenTrabajo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  titulo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  descripcion!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class AlertaOperativaResponseDto {
  @ApiProperty()
  idAlerta!: string;

  @ApiProperty()
  codigoCuenta!: string;

  @ApiProperty()
  idBodega!: string;

  @ApiProperty()
  tipo!: string;

  @ApiProperty()
  estado!: string;

  @ApiPropertyOptional({ nullable: true })
  idUbicacion!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idOrdenTrabajo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idResponsable!: string | null;

  @ApiProperty()
  titulo!: string;

  @ApiPropertyOptional({ nullable: true })
  descripcion!: string | null;

  @ApiPropertyOptional({ nullable: true })
  motivoCierre!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  cerradaAt!: Date | null;
}

export class LlamadaOperativaResponseDto {
  @ApiProperty()
  idLlamada!: string;

  @ApiProperty()
  codigoCuenta!: string;

  @ApiProperty()
  idBodega!: string;

  @ApiProperty()
  fromRol!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  idSolicitante!: string;

  @ApiProperty()
  atendida!: boolean;

  @ApiPropertyOptional({ nullable: true })
  idAtendidoPor!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  atendidaAt!: Date | null;
}

export class OperarioDisponibleResponseDto {
  @ApiProperty()
  idUsuario!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  tareasPendientes!: number;

  @ApiProperty()
  disponible!: boolean;

  @ApiPropertyOptional({ nullable: true })
  ultimoPing!: string | null;
}
