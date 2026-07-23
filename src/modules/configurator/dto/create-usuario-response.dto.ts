import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WmsRol } from '../../../generated/prisma/client';

export class CreateUsuarioResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  idUsuario!: string;

  @ApiProperty({ example: 'operario.bodega1' })
  username!: string;

  @ApiProperty({ example: 'Operario Bodega 1' })
  nombre!: string;

  @ApiProperty({ enum: WmsRol, example: WmsRol.operario })
  idRol!: WmsRol;

  @ApiPropertyOptional({ example: 'CTA001', nullable: true })
  codigoCuenta!: string | null;

  @ApiProperty({ example: 'operario@empresa.com' })
  correo!: string;

  @ApiPropertyOptional({
    example: '+573001112233',
    nullable: true,
  })
  telefono!: string | null;
}
