import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../../core/auth/supabase-auth.guard';
import { AUTH_CLIENT_HEADER } from '../../shared/constants/auth-client.constants';
import type { AuthClient } from '../../shared/constants/auth-client.constants';
import { AuthClientParam } from '../../shared/decorators/auth-client.decorator';
import {
  CurrentAccessToken,
  CurrentSupabaseUser,
} from '../../shared/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import {
  LoginResponseDto,
  MeResponseDto,
  PreloginResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { MateoExchangeDto } from './dto/mateo-exchange.dto';
import {
  MateoExchangeResponseDto,
  MateoHandoffResponseDto,
} from './dto/mateo-response.dto';
import { PreloginDto } from './dto/prelogin.dto';
import type {
  LoginResponse,
  MateoExchangeResponse,
  MateoHandoffResponse,
  MeResponse,
  PreloginResponse,
} from './interfaces/auth.interfaces';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('prelogin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar identidad y contexto',
    description:
      'Valida identidad y contexto (platform/tenant) antes de solicitar contrase?a. Con `X-Auth-Client: wms` el identificador debe ser correo; con `mateo`, username.',
  })
  @ApiHeader({
    name: AUTH_CLIENT_HEADER,
    required: false,
    description: 'Cliente de autenticaci?n: wms | mateo',
  })
  @ApiOkResponse({ type: PreloginResponseDto })
  @ApiResponse({ status: 400, description: 'Body inv?lido (validaci?n DTO)' })
  @ApiResponse({ status: 403, description: 'Empresa no coincide o inactiva' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado o inactivo' })
  @ApiResponse({ status: 422, description: 'Tenant sin codigoEmpresa' })
  prelogin(
    @Body() dto: PreloginDto,
    @AuthClientParam() client: AuthClient | null,
  ): Promise<PreloginResponse> {
    return this.authService.prelogin(dto, client);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesi?n',
    description:
      'Autentica con Supabase Auth tras repetir las validaciones de prelogin. Con `X-Auth-Client: wms` el identificador debe ser correo; con `mateo`, username.',
  })
  @ApiHeader({
    name: AUTH_CLIENT_HEADER,
    required: false,
    description: 'Cliente de autenticaci?n: wms | mateo',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiResponse({ status: 400, description: 'Body inv?lido' })
  @ApiResponse({ status: 401, description: 'Credenciales Supabase inv?lidas' })
  @ApiResponse({ status: 403, description: 'Empresa no coincide o inactiva' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 422, description: 'Tenant sin codigoEmpresa' })
  login(
    @Body() dto: LoginDto,
    @AuthClientParam() client: AuthClient | null,
  ): Promise<LoginResponse> {
    return this.authService.login(dto, client);
  }

  @Post('mateo-handoff')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Generar código SSO (WMS ↔ Mateo)',
    description:
      'Usuario autenticado (Bearer Supabase, sesión WMS o Mateo) obtiene un código JWT de un solo uso (TTL 60s). El cliente destino lo canjea en POST /auth/mateo-exchange.',
  })
  @ApiOkResponse({ type: MateoHandoffResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inv?lido' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado o inactivo' })
  createMateoHandoff(
    @CurrentSupabaseUser() user: User,
  ): Promise<MateoHandoffResponse> {
    return this.authService.createMateoHandoff(user.id);
  }

  @Post('mateo-exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Canjear código SSO (WMS ↔ Mateo)',
    description:
      'Intercambia el código JWT obtenido en mateo-handoff por tokens Supabase y perfil de usuario. Endpoint público; bidireccional (WMS→Mateo o Mateo→WMS). El código es de un solo uso y expira en 60 segundos.',
  })
  @ApiBody({ type: MateoExchangeDto })
  @ApiOkResponse({ type: MateoExchangeResponseDto })
  @ApiUnauthorizedResponse({
    description: 'C?digo inv?lido, expirado o ya utilizado',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado o inactivo' })
  exchangeMateoCode(
    @Body() dto: MateoExchangeDto,
  ): Promise<MateoExchangeResponse> {
    return this.authService.exchangeMateoCode(dto.code);
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Perfil del usuario autenticado',
    description: 'Retorna perfil y contexto de sesi?n del usuario autenticado.',
  })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inv?lido o expirado',
  })
  @ApiResponse({ status: 404, description: 'Usuario inactivo o no vinculado' })
  getMe(@CurrentSupabaseUser() user: User): Promise<MeResponse> {
    return this.authService.getMe(user.id);
  }

  @Post('logout')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cerrar sesi?n',
    description: 'Invalida la sesi?n global del usuario en Supabase Auth.',
  })
  @ApiNoContentResponse({ description: 'Sesi?n cerrada correctamente' })
  @ApiUnauthorizedResponse({
    description: 'Token inv?lido o fallo al cerrar sesi?n',
  })
  async logout(@CurrentAccessToken() accessToken: string): Promise<void> {
    await this.authService.logout(accessToken);
  }
}
