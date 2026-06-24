import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import type { AuthenticatedRequest } from '../tenant/tenant-context.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly supabaseAuth: SupabaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;
    const token = extractBearerToken(
      Array.isArray(authorization) ? authorization[0] : authorization,
    );
    const user = await this.supabaseAuth.getUserFromToken(token);

    request.supabaseUser = user;
    request.accessToken = token;

    return true;
  }
}

function extractBearerToken(authorization?: string): string {
  if (!authorization?.startsWith('Bearer ')) {
    throw new UnauthorizedException('Token de autorización requerido');
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    throw new UnauthorizedException('Token de autorización requerido');
  }

  return token;
}
