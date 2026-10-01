import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Respuesta de POST /ventas/leer-pedido (mismo contrato que el BFF Next). */
export class PedidoLineaExtraidaDto {
  @ApiProperty()
  textoOriginal!: string;

  @ApiPropertyOptional({ nullable: true })
  productoCatalogo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  cantidad!: number | null;

  @ApiPropertyOptional({ nullable: true, enum: ['KGM', 'CJ', 'UN', null] })
  unidad!: 'KGM' | 'CJ' | 'UN' | null;

  @ApiPropertyOptional({ nullable: true })
  cajas!: number | null;

  @ApiPropertyOptional({ nullable: true })
  presentacion!: string | null;

  @ApiPropertyOptional({ nullable: true })
  especificacion!: string | null;

  @ApiPropertyOptional({ nullable: true })
  numeroPedido!: string | null;

  @ApiPropertyOptional({ nullable: true })
  almacen!: string | null;

  @ApiPropertyOptional({ nullable: true })
  numeroAlmacen!: string | null;

  @ApiPropertyOptional({ nullable: true })
  referenciaPedido!: string | null;

  @ApiPropertyOptional({ nullable: true })
  codigoProductoCliente!: string | null;

  @ApiPropertyOptional({ nullable: true })
  responsableExterno!: string | null;

  @ApiPropertyOptional({ nullable: true })
  precioUnitario!: number | null;
}

export class PedidoExtraidoResponseDto {
  @ApiPropertyOptional({ nullable: true })
  fechaEntrega!: string | null;

  @ApiPropertyOptional({ nullable: true })
  centroConsumo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  observaciones!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ordenCompraHotel!: string | null;

  @ApiPropertyOptional({ nullable: true })
  nombreCliente!: string | null;

  @ApiPropertyOptional({ nullable: true })
  rfc!: string | null;

  @ApiPropertyOptional({ nullable: true })
  regimen!: string | null;

  @ApiPropertyOptional({ nullable: true })
  direccion!: string | null;

  @ApiPropertyOptional({ nullable: true })
  anden!: string | null;

  @ApiPropertyOptional({ nullable: true })
  contacto!: string | null;

  @ApiPropertyOptional({ nullable: true })
  telefono!: string | null;

  @ApiPropertyOptional({ nullable: true })
  horarioDesde!: string | null;

  @ApiPropertyOptional({ nullable: true })
  horarioHasta!: string | null;

  @ApiPropertyOptional({ nullable: true })
  tolerancia!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sustituciones!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lote!: string | null;

  @ApiPropertyOptional({ nullable: true })
  temperatura!: string | null;

  @ApiProperty({ type: [PedidoLineaExtraidaDto] })
  lineas!: PedidoLineaExtraidaDto[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'Renglones origen_correo para agrupar órdenes de trabajo',
  })
  origenCorreo!: unknown[];

  @ApiPropertyOptional({ nullable: true })
  advertencia!: string | null;

  @ApiProperty({ type: [String] })
  archivosNoLegibles!: string[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Cuerpo del mensaje/correo para notas generales del PDF',
  })
  textoOrigen!: string | null;
}

export class ArchivoExtraidoResponseDto {
  @ApiProperty()
  nombre!: string;

  @ApiProperty({ enum: ['texto', 'imagen', 'no_legible'] })
  tipo!: 'texto' | 'imagen' | 'no_legible';

  @ApiPropertyOptional()
  contenido?: string;

  @ApiPropertyOptional()
  mime?: string;

  @ApiPropertyOptional()
  base64?: string;

  @ApiPropertyOptional()
  motivo?: string;
}
