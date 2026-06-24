import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AUTH_FLOW, AUTH_SCOPE } from '../../../shared/constants/auth.constants';

export class UserPreviewDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  idUsuario!: string;

  @ApiProperty({ example: 'Nombre Apellido' })
  nombre!: string;

  @ApiProperty({ example: 'usuario' })
  username!: string;

  @ApiProperty({ example: 'configurador' })
  idRol!: string;

  @ApiProperty({ example: 'Configurador (TI)' })
  nombreRol!: string;

  @ApiPropertyOptional({ example: 'EMP001', nullable: true })
  codigoEmpresa!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  codigoCuenta!: string | null;
}

export class PreloginResponseDto {
  @ApiProperty({ example: true })
  ok!: true;

  @ApiProperty({ example: true })
  requiresPassword!: true;

  @ApiProperty({ enum: Object.values(AUTH_FLOW), example: AUTH_FLOW.PLATFORM })
  flow!: string;

  @ApiProperty({ type: UserPreviewDto })
  userPreview!: UserPreviewDto;
}

export class SessionContextDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  idUsuario!: string;

  @ApiProperty({ example: 'administrador_cuenta' })
  idRol!: string;

  @ApiPropertyOptional({ example: 'EMP001', nullable: true })
  codigoEmpresa!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  codigoCuenta!: string | null;

  @ApiProperty({ enum: Object.values(AUTH_SCOPE), example: AUTH_SCOPE.TENANT })
  scope!: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'v1.MRj...' })
  refreshToken!: string;

  @ApiProperty({ example: 3600 })
  expiresIn!: number;

  @ApiProperty({ example: 'bearer' })
  tokenType!: string;

  @ApiProperty({ type: SessionContextDto })
  context!: SessionContextDto;
}

export class MeResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  idUsuario!: string;

  @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440001' })
  idAuth!: string;

  @ApiProperty({ example: 'Nombre Apellido' })
  nombre!: string;

  @ApiProperty({ example: 'usuario' })
  username!: string;

  @ApiProperty({ example: 'user@empresa.com' })
  correo!: string;

  @ApiProperty({ example: 'administrador_cuenta' })
  idRol!: string;

  @ApiProperty({ example: 'Administrador de cuenta' })
  nombreRol!: string;

  @ApiProperty({ example: 'cuenta' })
  nivelRol!: string;

  @ApiPropertyOptional({ example: 'EMP001', nullable: true })
  codigoEmpresa!: string | null;

  @ApiPropertyOptional({ example: 'Empresa Demo SA', nullable: true })
  razonSocialEmpresa!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  codigoCuenta!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  nombreComercialCuenta!: string | null;

  @ApiProperty({ enum: Object.values(AUTH_SCOPE), example: AUTH_SCOPE.TENANT })
  scope!: string;

  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440010'],
    description: 'Bodegas asignadas al usuario (vacío si no aplica)',
  })
  idBodegas!: string[];
}
