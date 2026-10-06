import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateConversacionDto {
  @ApiPropertyOptional({
    description: 'Título opcional de la conversación',
    example: 'Consulta de inventario',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titulo?: string;
}

export class AppendMensajeDto {
  @ApiProperty({ enum: ['user', 'ai'], example: 'user' })
  @IsIn(['user', 'ai'])
  rol!: 'user' | 'ai';

  @ApiPropertyOptional({
    enum: ['text', 'image'],
    example: 'text',
    default: 'text',
  })
  @IsOptional()
  @IsIn(['text', 'image'])
  tipo?: 'text' | 'image';

  @ApiPropertyOptional({
    description:
      'Texto del mensaje. En tipo image es el pie (caption); la URL va en urlImagen.',
    example: '¿Cuántas cajas hay en frío?',
  })
  @ValidateIf((o: AppendMensajeDto) => (o.tipo ?? 'text') !== 'image')
  @IsString()
  @IsNotEmpty()
  contenido?: string;

  @ApiPropertyOptional({
    description:
      'URL Cloudinary (secure_url). Requerido cuando tipo = image.',
    example: 'https://res.cloudinary.com/demo/image/upload/v1/evidencia.jpg',
  })
  @ValidateIf((o: AppendMensajeDto) => (o.tipo ?? 'text') === 'image')
  @IsString()
  @IsNotEmpty()
  urlImagen?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  esError?: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp del cliente (ISO-8601); default now()',
    example: '2026-07-16T16:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  createdAt?: string;
}
