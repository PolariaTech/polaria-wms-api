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
    description: 'Si es false, los usuarios de la cuenta no pueden iniciar sesión',
  })
  estaActiva!: boolean;
}
