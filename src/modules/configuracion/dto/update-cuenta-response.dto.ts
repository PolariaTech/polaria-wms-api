import { ApiProperty } from '@nestjs/swagger';

export class UpdateCuentaResponseDto {
  @ApiProperty({ example: '49M04' })
  codigoCuenta!: string;

  @ApiProperty({ example: 'EVU53' })
  codigoEmpresa!: string;

  @ApiProperty({ example: 'Tecno-Tech' })
  nombreComercial!: string;

  @ApiProperty({
    example: true,
    description:
      'Si es false, los usuarios de la cuenta no pueden iniciar sesión',
  })
  estaActiva!: boolean;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
    description: 'Bodega por defecto de la cuenta, si está definida',
  })
  idBodegaDefault!: string | null;
}
