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
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../../core/auth/supabase-auth.guard';
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
import { PreloginDto } from './dto/prelogin.dto';
import type { LoginResponse, MeResponse, PreloginResponse } from './interfaces/auth.interfaces';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('prelogin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar identidad y contexto',
    description:
      'Valida identidad y contexto (platform/tenant) antes de solicitar contraseña.',
  })
  @ApiOkResponse({ type: PreloginResponseDto })
  @ApiResponse({ status: 400, description: 'Body inválido (validación DTO)' })
  @ApiResponse({ status: 403, description: 'Empresa no coincide o inactiva' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado o inactivo' })
  @ApiResponse({ status: 422, description: 'Tenant sin codigoEmpresa' })
  prelogin(@Body() dto: PreloginDto): Promise<PreloginResponse> {
    return this.authService.prelogin(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Autentica con Supabase Auth tras repetir las validaciones de prelogin.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiResponse({ status: 400, description: 'Body inválido' })
  @ApiResponse({ status: 401, description: 'Credenciales Supabase inválidas' })
  @ApiResponse({ status: 403, description: 'Empresa no coincide o inactiva' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 422, description: 'Tenant sin codigoEmpresa' })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Perfil del usuario autenticado',
    description: 'Retorna perfil y contexto de sesión del usuario autenticado.',
  })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido o expirado',
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
    summary: 'Cerrar sesión',
    description: 'Invalida la sesión global del usuario en Supabase Auth.',
  })
  @ApiNoContentResponse({ description: 'Sesión cerrada correctamente' })
  @ApiUnauthorizedResponse({
    description: 'Token inválido o fallo al cerrar sesión',
  })
  async logout(@CurrentAccessToken() accessToken: string): Promise<void> {
    await this.authService.logout(accessToken);
  }
}
