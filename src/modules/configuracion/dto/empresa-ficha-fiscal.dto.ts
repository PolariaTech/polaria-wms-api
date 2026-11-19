import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

function textoOpcional(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const limpio = value.trim();
  return limpio.length === 0 ? null : limpio;
}

function soloSiHayTexto(_objeto: object, value: unknown): boolean {
  return value !== null && value !== undefined;
}

/** Campos fiscales y bancarios opcionales de public.empresa. */
export class EmpresaFichaFiscalDto {
  @ApiPropertyOptional({ nullable: true, example: 'APU210325668' })
  @IsOptional()
  @Transform(({ value }) => textoOpcional(value))
  @ValidateIf(soloSiHayTexto)
  @IsString()
  rfc?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '601' })
  @IsOptional()
  @Transform(({ value }) => textoOpcional(value))
  @ValidateIf(soloSiHayTexto)
  @IsString()
  @Matches(/^[0-9]{3}$/, { message: 'El régimen fiscal no es válido.' })
  regimenFiscal?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '77560' })
  @IsOptional()
  @Transform(({ value }) => textoOpcional(value))
  @ValidateIf(soloSiHayTexto)
  @IsString()
  codigoPostalExpedicion?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Aguacates de Puebla' })
  @IsOptional()
  @Transform(({ value }) => textoOpcional(value))
  @ValidateIf(soloSiHayTexto)
  @IsString()
  nombreCuentaBancaria?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'BBVA' })
  @IsOptional()
  @Transform(({ value }) => textoOpcional(value))
  @ValidateIf(soloSiHayTexto)
  @IsString()
  banco?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '012528001186364430' })
  @IsOptional()
  @Transform(({ value }) => textoOpcional(value))
  @ValidateIf(soloSiHayTexto)
  @IsString()
  clabe?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'cobranza@aguacatesdepuebla.com',
  })
  @IsOptional()
  @Transform(({ value }) => textoOpcional(value))
  @ValidateIf(soloSiHayTexto)
  @IsString()
  @Matches(/^[^@ ]+@[^@ ]+[.][^@ ]+$/, {
    message: 'El correo de cobranza no es válido.',
  })
  correoCobranza?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'CS-' })
  @IsOptional()
  @Transform(({ value }) => textoOpcional(value))
  @ValidateIf(soloSiHayTexto)
  @IsString()
  serieFactura?: string | null;
}
