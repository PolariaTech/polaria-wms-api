import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TECHOS_PROVISIONALES_REAGRUPACION } from '../ai/utils/reagrupacion-ot.validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Renglón de una OT tal como está en el borrador del formulario. */
export class RenglonReagrupacionDto {
  @ApiProperty({
    description: 'Id estable del renglón (lo asigna el cliente).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  renglonId!: string;

  @ApiProperty({ example: 'AGUACATE PRIMERA (170 a 200g)' })
  @IsString()
  @MaxLength(500)
  producto!: string;

  @ApiProperty({
    description: 'Cantidad del renglón (número o texto numérico).',
    example: 25,
  })
  @IsDefined()
  cantidad!: number | string;

  @ApiPropertyOptional({ example: 'KGM' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unidad?: string;
}

/** Orden de trabajo (agrupación de renglones) del borrador. */
export class OtReagrupacionDto {
  @ApiProperty({
    description: 'Id estable de la OT (`_otId` o clave de grupo).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  otId!: string;

  @ApiProperty({ example: 'PCMC-PO-062710 — COMEDOR' })
  @IsString()
  @MaxLength(500)
  etiqueta!: string;

  @ApiProperty({ example: 'COMEDOR' })
  @IsString()
  @MaxLength(500)
  almacen!: string;

  @ApiProperty({ example: 'PCMC-PO-062710' })
  @IsString()
  @MaxLength(500)
  numeroPedido!: string;

  @ApiProperty({ type: [RenglonReagrupacionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RenglonReagrupacionDto)
  renglones!: RenglonReagrupacionDto[];
}

export class EstadoBaseReagrupacionDto {
  @ApiProperty({ type: [OtReagrupacionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OtReagrupacionDto)
  ots!: OtReagrupacionDto[];
}

export class HistorialReagrupacionDto {
  @ApiProperty({ description: 'Instrucción de un turno anterior (rechazado).' })
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(TECHOS_PROVISIONALES_REAGRUPACION.maxInstruccion)
  instruccion!: string;
}

/**
 * Body de POST /ventas/ordenes/:id/ordenes-trabajo/propuesta-reagrupacion.
 * No lleva `codigoCuenta`: la cuenta sale del JWT (el pipe global rechaza campos extra).
 */
export class PropuestaReagrupacionBodyDto {
  @ApiProperty({ description: 'Identifica la solicitud; se devuelve igual.' })
  @IsUUID()
  requestId!: string;

  @ApiProperty({
    description: 'Instrucción en lenguaje natural para reorganizar las OT.',
    example: 'Junta las OT de comedor y de bares en una sola',
  })
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(TECHOS_PROVISIONALES_REAGRUPACION.maxInstruccion)
  instruccion!: string;

  @ApiPropertyOptional({
    type: [HistorialReagrupacionDto],
    description:
      'Instrucciones previas rechazadas, en orden. El modelo parte siempre del estado original.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TECHOS_PROVISIONALES_REAGRUPACION.maxHistorial)
  @ValidateNested({ each: true })
  @Type(() => HistorialReagrupacionDto)
  historial?: HistorialReagrupacionDto[];

  @ApiProperty({ type: EstadoBaseReagrupacionDto })
  @ValidateNested()
  @Type(() => EstadoBaseReagrupacionDto)
  estadoBase!: EstadoBaseReagrupacionDto;
}

export class OtPropuestaDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Id de la OT existente.',
  })
  otId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'NUEVA-1',
    description: 'Clave de una OT nueva (el cliente le genera el id real).',
  })
  nuevaClave!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Solo en OT nuevas; saneada.',
  })
  etiquetaSugerida!: string | null;

  @ApiProperty({ type: [String] })
  renglonIds!: string[];
}

export class ResumenReagrupacionDto {
  @ApiProperty() antes!: number;
  @ApiProperty() despues!: number;
  @ApiProperty() nuevas!: number;
  @ApiProperty() vacias!: number;
}

export class MovimientoReagrupacionDto {
  @ApiProperty() renglonId!: string;
  @ApiProperty() deOtId!: string;
  @ApiProperty({ description: 'Id de OT existente o clave `NUEVA-n`.' })
  aOtId!: string;
}

/** Respuesta 200: una propuesta, una aclaración o un rechazo. */
export class PropuestaReagrupacionResponseDto {
  @ApiProperty() requestId!: string;

  @ApiPropertyOptional() propuestaId?: string;
  @ApiPropertyOptional({ description: 'Hash del estado base recibido.' })
  baseHash?: string;
  @ApiPropertyOptional({ type: [OtPropuestaDto] }) ots?: OtPropuestaDto[];
  @ApiPropertyOptional({ type: ResumenReagrupacionDto })
  resumen?: ResumenReagrupacionDto;
  @ApiPropertyOptional({ type: [MovimientoReagrupacionDto] })
  movimientos?: MovimientoReagrupacionDto[];

  @ApiPropertyOptional({
    description: 'Texto fijo del servidor (no es texto del modelo).',
  })
  aclaracion?: string;

  @ApiPropertyOptional({ enum: ['FUERA_DE_ALCANCE'] })
  rechazo?: 'FUERA_DE_ALCANCE';
}
