import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from '../../../core/tenant/tenant-context.interface';

/**
 * Auth para endpoints IA consumibles por terceros (sin JWT de usuario).
 * Acepta `X-Api-Key` (= PEDIDO_IA_API_KEY) o `X-Internal-Api-Key` (= INTERNAL_API_KEY).
 */
@Injectable()
export class PedidoIaApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const apiKey = firstHeader(request.headers['x-api-key']);
    const internalKey = firstHeader(request.headers['x-internal-api-key']);

    const expectedPublic = this.config.get<string>('PEDIDO_IA_API_KEY')?.trim();
    const expectedInternal = this.config
      .get<string>('INTERNAL_API_KEY')
      ?.trim();

    const okPublic =
      Boolean(expectedPublic) &&
      Boolean(apiKey) &&
      apiKey === expectedPublic;
    const okInternal =
      Boolean(expectedInternal) &&
      Boolean(internalKey) &&
      internalKey === expectedInternal;

    if (okPublic || okInternal) {
      return true;
    }

    throw new UnauthorizedException(
      'API key inválida o ausente. Usa header X-Api-Key (PEDIDO_IA_API_KEY) o X-Internal-Api-Key.',
    );
  }
}

function firstHeader(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim();
  return value?.trim();
}
