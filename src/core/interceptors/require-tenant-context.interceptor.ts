import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../tenant/tenant-context.interface';
import { REQUIRE_TENANT_CONTEXT_KEY } from '../guards/require-tenant.decorator';

@Injectable()
export class RequireTenantContextInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_TENANT_CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (required) {
      const request = context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();

      if (!request.tenantContext) {
        throw new ForbiddenException('Contexto de tenant inválido o ausente');
      }
    }

    return next.handle();
  }
}
