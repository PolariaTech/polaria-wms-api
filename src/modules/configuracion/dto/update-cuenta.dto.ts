import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateCuentaDto {
  @ApiPropertyOptional({ example: 'Tecno-Tech' })
  @IsOptional()
  @IsString()
  nombreComercial?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Credenciales / acceso de la cuenta. false bloquea el inicio de sesión de sus usuarios.',
  })
  @IsOptional()
  @IsBoolean()
  estaActiva?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description:
      'Set deseado de bodegas de la misma empresa asignadas a esta cuenta. ' +
      'Las que se desmarquen se mueven a otra cuenta de la empresa ' +
      '(codigoCuentaDestinoDesvinculacion o la primera alternativa disponible).',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  idsBodegas?: string[];

  @ApiPropertyOptional({
    example: 'CTA002',
    description:
      'Cuenta destino (misma empresa) para bodegas desvinculadas. ' +
      'Obligatoria si se desvincula y no hay otra cuenta automática usable.',
  })
  @IsOptional()
  @IsString()
  codigoCuentaDestinoDesvinculacion?: string;
}
