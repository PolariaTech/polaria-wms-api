import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class EnviarAprobacionDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description:
      'Proveedor a asignar si la solicitud (p. ej. creada por el bot) no lo trae',
  })
  @IsOptional()
  @IsUUID()
  idProveedor?: string;
}
