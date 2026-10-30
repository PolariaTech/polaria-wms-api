import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Largo máximo de la nota del usuario (no viaja al modelo en esta versión). */
const MAX_INSTRUCCION_CORRECCION = 4000;

/** Lo que el usuario dijo que espera (se compara con el resultado; no condiciona la lectura). */
export class ExpectativasUsuarioDto {
  @ApiPropertyOptional({ description: 'Cuántas OT dijo el usuario que debe haber.', example: 21 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  totalOt?: number;

  @ApiPropertyOptional({ description: 'Total en dinero que el usuario espera.', example: 27905.25 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  importeTotal?: number;
}

/**
 * Body de POST /ventas/ordenes/:id/ordenes-trabajo/propuesta-correccion-correo.
 * No lleva archivos, rutas ni estado: el servidor lee los adjuntos originales de la OV
 * (la cuenta sale del JWT y los paths de `origen_archivos`, nunca del cliente).
 */
export class PropuestaCorreccionCorreoBodyDto {
  @ApiProperty({ description: 'Identifica la solicitud; se devuelve igual.' })
  @IsUUID()
  requestId!: string;

  @ApiPropertyOptional({
    description:
      'Nota del usuario sobre qué revisar. Se registra su largo; por ahora no condiciona la lectura.',
    example: 'Reorganizar en 21 OT y que el total coincida con la factura',
  })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(MAX_INSTRUCCION_CORRECCION)
  instruccion?: string;

  @ApiPropertyOptional({
    type: ExpectativasUsuarioDto,
    description:
      'Lo que el usuario espera (viene de `interpretar-instruccion`); la respuesta lo compara con lo que dicen los documentos.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExpectativasUsuarioDto)
  expectativas?: ExpectativasUsuarioDto;
}

export class VerificacionDocumentoDto {
  @ApiPropertyOptional({ nullable: true, description: '«Total pedido» del documento.' })
  totalDocumento!: number | null;
  @ApiProperty({ description: 'Suma de cantidad × precio de lo leído.' })
  importe!: number;
  @ApiPropertyOptional({ nullable: true }) diferencia!: number | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'true/false si el documento declara total; null si no se pudo verificar.',
  })
  cuadra!: boolean | null;
}

export class DocumentoCorreccionDto {
  @ApiProperty() nombre!: string;
  @ApiPropertyOptional({ nullable: true }) oc!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    enum: ['contenido', 'nombre', 'ambas'],
    description: 'De dónde salió la OC del documento.',
  })
  ocFuente!: 'contenido' | 'nombre' | 'ambas' | null;
  @ApiProperty() renglones!: number;
  @ApiProperty({ type: VerificacionDocumentoDto })
  verificacion!: VerificacionDocumentoDto;
  @ApiProperty({ description: 'Se releyó por bloques de páginas.' })
  relecturaPorBloques!: boolean;
}

export class OtCorreccionDto {
  @ApiProperty({ description: 'Clave estable de la OT: pedido + almacén.' })
  id!: string;
  @ApiProperty() etiqueta!: string;
  @ApiProperty() numeroPedido!: string;
  @ApiProperty() almacen!: string;
  @ApiProperty() totalCantidad!: number;
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'Renglones en el formato de `origen_correo`.',
  })
  renglones!: Array<Record<string, unknown>>;
}

export class ResumenCorreccionDto {
  @ApiProperty() otAntes!: number;
  @ApiProperty() otDespues!: number;
  @ApiProperty() renglonesAntes!: number;
  @ApiProperty() renglonesDespues!: number;
  @ApiProperty() importeAntes!: number;
  @ApiProperty() importeDespues!: number;
}

export class DiffCorreccionDto {
  @ApiProperty({ type: [String], description: 'Ids de OT que no existían.' })
  otNuevas!: string[];
  @ApiProperty({ type: [String], description: 'Ids de OT que ya no están.' })
  otEliminadas!: string[];
  @ApiProperty() renglonesAgregados!: number;
  @ApiProperty() renglonesQuitados!: number;
}

export class AdvertenciaCorreccionDto {
  @ApiProperty() codigo!: string;
  @ApiPropertyOptional() documento?: string;
  @ApiProperty() detalle!: string;
}

export class ExpectativasResultadoDto {
  @ApiPropertyOptional({ nullable: true }) totalOtPedido!: number | null;
  @ApiPropertyOptional({ nullable: true }) importeTotalPedido!: number | null;
  @ApiProperty() totalOtResultado!: number;
  @ApiProperty() importeResultado!: number;
  @ApiPropertyOptional({ nullable: true, description: 'null si el usuario no lo dijo.' })
  coincideTotalOt!: boolean | null;
  @ApiPropertyOptional({ nullable: true, description: 'null si el usuario no lo dijo.' })
  coincideImporte!: boolean | null;
}

export class PropuestaCorreccionCorreoResponseDto {
  @ApiProperty() requestId!: string;
  @ApiProperty() propuestaId!: string;
  @ApiProperty({
    description:
      'Hash del `origen_correo` actual y de los adjuntos leídos; la web lo compara al aplicar.',
  })
  baseHash!: string;
  @ApiProperty({ type: [DocumentoCorreccionDto] })
  documentos!: DocumentoCorreccionDto[];
  @ApiProperty({ type: [OtCorreccionDto] }) ots!: OtCorreccionDto[];
  @ApiProperty({ type: ResumenCorreccionDto }) resumen!: ResumenCorreccionDto;
  @ApiProperty({ type: DiffCorreccionDto }) diff!: DiffCorreccionDto;
  @ApiProperty({ type: [AdvertenciaCorreccionDto] })
  advertencias!: AdvertenciaCorreccionDto[];
  @ApiPropertyOptional({
    type: ExpectativasResultadoDto,
    description: 'Solo si el usuario dijo cuántas OT o qué total esperaba.',
  })
  expectativas?: ExpectativasResultadoDto;
}

/** Respuesta 202 de POST …/propuesta-correccion-correo: la corrección corre en segundo plano. */
export class CorreccionIniciadaResponseDto {
  @ApiProperty() requestId!: string;
  @ApiProperty({ description: 'Id del trabajo para consultar su avance.' })
  jobId!: string;
  @ApiProperty({ enum: ['procesando'] }) estado!: 'procesando';
}

/** Respuesta 200 de GET …/propuesta-correccion-correo/:jobId. */
export class CorreccionConsultaResponseDto {
  @ApiProperty({ enum: ['procesando', 'listo'] })
  estado!: 'procesando' | 'listo';
  @ApiPropertyOptional({ type: PropuestaCorreccionCorreoResponseDto })
  propuesta?: PropuestaCorreccionCorreoResponseDto;
}

/** Body de POST /ventas/ordenes/:id/ordenes-trabajo/interpretar-instruccion. */
export class InterpretarInstruccionBodyDto {
  @ApiProperty({ description: 'Identifica la solicitud; se devuelve igual.' })
  @IsUUID()
  requestId!: string;

  @ApiProperty({
    description: 'Lo que el usuario escribió en el chat.',
    example: 'Este pedido debe ser reorganizado en 21 OT y que el total de la factura sea 27,905.25',
  })
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_INSTRUCCION_CORRECCION)
  instruccion!: string;
}

export class InterpretacionInstruccionResponseDto {
  @ApiProperty() requestId!: string;
  @ApiProperty({
    enum: ['reorganizar', 'releer_documentos'],
    description:
      '`reorganizar` mueve renglones que ya existen; `releer_documentos` relee el correo y los archivos originales.',
  })
  intencion!: 'reorganizar' | 'releer_documentos';
  @ApiProperty({ description: 'Frase corta que explica la decisión (saneada).' })
  motivo!: string;
  @ApiProperty({ type: ExpectativasUsuarioDto, description: 'Lo que el usuario dijo que espera.' })
  expectativas!: { totalOt?: number; importeTotal?: number };
  @ApiProperty({ description: 'La decisión la tomó el respaldo por reglas porque el modelo falló.' })
  porReglas!: boolean;
}
