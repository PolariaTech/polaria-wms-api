import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AUTH_SCOPE } from '../../../shared/constants/auth.constants';

export class MateoHandoffResponseDto {
  @ApiProperty({
    description: 'JWT de un solo uso para canjear en POST /auth/mateo-exchange',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  code!: string;

  @ApiProperty({
    description: 'Segundos hasta expiración del código',
    example: 60,
  })
  expiresIn!: number;
}

export class MateoWidgetTokenResponseDto {
  @ApiProperty({
    description:
      'JWT HS256 para el widget Mateo embebido (TTL 300s, reutilizable hasta expirar)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token!: string;

  @ApiProperty({
    description: 'Segundos hasta expiración del token',
    example: 300,
  })
  expiresIn!: number;
}

export class MateoExchangeUserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  idUsuario!: string;

  @ApiProperty({ example: 'admin.cuenta' })
  username!: string;

  @ApiProperty({ example: 'Admin Cuenta' })
  nombre!: string;

  @ApiProperty({ example: 'admin@empresa.com' })
  correo!: string;

  @ApiProperty({ example: 'Administrador de cuenta' })
  nombreRol!: string;

  @ApiPropertyOptional({ example: 'EMP001', nullable: true })
  codigoEmpresa!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  codigoCuenta!: string | null;

  @ApiProperty({
    enum: Object.values(AUTH_SCOPE),
    example: AUTH_SCOPE.TENANT,
  })
  scope!: string;
}

export class MateoExchangeResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'v1.MRj...' })
  refreshToken!: string;

  @ApiProperty({ type: MateoExchangeUserDto })
  user!: MateoExchangeUserDto;
}
