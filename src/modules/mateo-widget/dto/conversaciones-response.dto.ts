import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MateoMensajeResponseDto {
  @ApiProperty()
  idMensaje!: string;

  @ApiProperty({ enum: ['user', 'ai'] })
  rol!: 'user' | 'ai';

  @ApiProperty({ enum: ['text', 'image'] })
  tipo!: 'text' | 'image';

  @ApiProperty()
  contenido!: string;

  @ApiProperty()
  esError!: boolean;

  @ApiProperty()
  createdAt!: string;
}

export class MateoConversacionListItemDto {
  @ApiProperty()
  idConversacion!: string;

  @ApiPropertyOptional({ nullable: true })
  titulo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  codigoCuenta!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class MateoConversacionDetalleDto extends MateoConversacionListItemDto {
  @ApiProperty({ type: [MateoMensajeResponseDto] })
  mensajes!: MateoMensajeResponseDto[];
}
