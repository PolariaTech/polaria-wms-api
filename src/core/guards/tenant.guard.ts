import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import {
  TENANT_HEADER_CODIGO_EMPRESA,
  TENANT_QUERY_CODIGO_EMPRESA,
} from '../tenant/tenant.constants';
import type { AuthenticatedRequest } from '../tenant/tenant-context.interface';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.supabaseUser?.id) {
      throw new UnauthorizedException('Token de autorización requerido');
    }

    const requestedCodigoEmpresa = extractRequestedCodigoEmpresa(request);
    request.tenantContext = await this.tenantService.buildContext(
      request.supabaseUser.id,
      requestedCodigoEmpresa,
    );

    return true;
  }
}

function extractRequestedCodigoEmpresa(
  request: AuthenticatedRequest,
): string | undefined {
  const headerValue = request.headers[TENANT_HEADER_CODIGO_EMPRESA];
  const queryValue = request.query[TENANT_QUERY_CODIGO_EMPRESA];

  const raw =
    (Array.isArray(headerValue) ? headerValue[0] : headerValue) ??
    (Array.isArray(queryValue) ? queryValue[0] : queryValue);

  const normalized = raw?.trim();
  return normalized || undefined;
}
