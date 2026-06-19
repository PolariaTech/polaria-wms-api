import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export interface SupabaseSessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);
  private readonly anonClient: SupabaseClient;
  private readonly adminClient: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.getOrThrow<string>('SUPABASE_URL');
    const anonKey = this.configService.getOrThrow<string>('SUPABASE_ANON_KEY');
    const serviceRoleKey = this.configService.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    const authOptions = {
      auth: { autoRefreshToken: false, persistSession: false },
    };

    this.anonClient = createClient(url, anonKey, authOptions);
    this.adminClient = createClient(url, serviceRoleKey, authOptions);
  }

  async signInWithPassword(
    email: string,
    password: string,
  ): Promise<SupabaseSessionTokens> {
    const { data, error } = await this.anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      this.logger.warn('Login fallido: credenciales inválidas');
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in ?? 3600,
      tokenType: 'bearer',
    };
  }

  async getUserFromToken(accessToken: string): Promise<User> {
    const { data, error } = await this.anonClient.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    return data.user;
  }

  async signOut(accessToken: string): Promise<void> {
    const user = await this.getUserFromToken(accessToken);
    const { error } = await this.adminClient.auth.admin.signOut(
      user.id,
      'global',
    );

    if (error) {
      this.logger.warn(`Error al cerrar sesión: ${error.message}`);
      throw new UnauthorizedException('No se pudo cerrar la sesión');
    }
  }

  async createSessionForEmail(email: string): Promise<SupabaseSessionTokens> {
    const { data: linkData, error: linkError } =
      await this.adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      this.logger.warn(
        `No se pudo generar sesión para ${email}: ${linkError?.message ?? 'sin token'}`,
      );
      throw new UnauthorizedException('No se pudo crear la sesión');
    }

    const { data: sessionData, error: verifyError } =
      await this.anonClient.auth.verifyOtp({
        type: 'magiclink',
        token_hash: linkData.properties.hashed_token,
      });

    if (verifyError || !sessionData.session) {
      this.logger.warn(
        `Verificación OTP fallida para ${email}: ${verifyError?.message ?? 'sin sesión'}`,
      );
      throw new UnauthorizedException('No se pudo crear la sesión');
    }

    return {
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
      expiresIn: sessionData.session.expires_in ?? 3600,
      tokenType: 'bearer',
    };
  }
}
