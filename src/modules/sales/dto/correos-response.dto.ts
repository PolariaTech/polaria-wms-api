import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IngresoCorreoResponseDto } from './ingreso-correo-response.dto';

/** Una fila del data table de correos de n8n, más el estado de ingreso en el WMS. */
export class CorreoFilaDto {
  @ApiPropertyOptional({ nullable: true, example: '2026-11-03T13:27:51.000Z' })
  recibidoEn!: string | null;

  @ApiPropertyOptional({ nullable: true })
  de!: string | null;

  @ApiPropertyOptional({ nullable: true })
  para!: string | null;

  @ApiPropertyOptional({ nullable: true })
  asunto!: string | null;

  @ApiProperty({ example: '1a1a198510cde156' })
  messageId!: string;

  @ApiPropertyOptional({ nullable: true })
  hilo!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Nombre del primer adjunto.',
  })
  adjunto!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      '`false` = el workflow lo descartó. `true` = lo tomó como pedido. `null` = el workflow ' +
      'aún no lo marcó (o es de antes de que el workflow anotara el resultado).',
  })
  nuevoPedido!: boolean | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Por qué el workflow lo descartó.',
  })
  motivo!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['recibido', 'ingresado', 'duplicado', 'error', 'no_es_pedido'],
    description:
      'Qué hizo el workflow con el correo. `recibido` = llegó y no terminó de procesarse; un ' +
      'correo que se queda ahí sin avanzar es uno que el workflow no tomó.',
  })
  resultado!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['alta', 'media', 'baja'],
    description: 'Qué tan seguro estaba el clasificador de si es un pedido.',
  })
  confianza!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Clase de correo según el clasificador (por ejemplo `pedido` o `no_es_pedido`).',
  })
  tipo!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'OV-00001132',
    description:
      'OV en que se convirtió el correo: la que anotó el workflow o, si no hay, la del ingreso ' +
      'hecho a mano desde el WMS. Si salieron varias OV, vienen separadas por coma.',
  })
  codigoOrdenVenta!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Id de la fila en el data table de n8n.',
  })
  idRegistro!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Cuándo se registró la fila en n8n (`createdAt`).',
  })
  registradoEn!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Última actualización de la fila en n8n (`updatedAt`).',
  })
  actualizadoEn!: string | null;

  @ApiPropertyOptional({
    type: IngresoCorreoResponseDto,
    nullable: true,
    description:
      'Presente si el WMS ya tiene (o está procesando) este correo como OV.',
  })
  ingreso!: IngresoCorreoResponseDto | null;
}

export class AdjuntoCorreoDto {
  @ApiProperty({
    description: 'Posición del adjunto: se usa para descargarlo.',
    example: 0,
  })
  indice!: number;

  @ApiProperty({ example: 'PO_2000.pdf' })
  nombre!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ description: 'Tamaño del archivo en bytes.', example: 48213 })
  tamano!: number;
}

/** El correo completo, tal como está en Gmail. Los adjuntos no traen sus bytes. */
export class CorreoContenidoResponseDto {
  @ApiProperty() asunto!: string;
  @ApiProperty() de!: string;
  @ApiProperty() para!: string;
  @ApiPropertyOptional({ nullable: true, example: '2026-11-03T13:27:51.000Z' })
  fecha!: string | null;

  @ApiProperty({ description: 'Cuerpo en texto plano (puede venir vacío).' })
  texto!: string;

  @ApiProperty({
    description:
      'Cuerpo en HTML tal cual llegó. NO es seguro: la web lo muestra en un marco aislado.',
  })
  html!: string;

  @ApiProperty({ type: [AdjuntoCorreoDto] })
  adjuntos!: AdjuntoCorreoDto[];
}

export class CorreosListaResponseDto {
  @ApiProperty() total!: number;
  @ApiProperty() pagina!: number;
  @ApiProperty() tamano!: number;
  @ApiProperty({ type: [CorreoFilaDto] }) filas!: CorreoFilaDto[];
}
