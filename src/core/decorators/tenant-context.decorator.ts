import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TenantContext } from '../tenant/tenant-context.interface';

export const TenantCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ tenantContext: TenantContext }>();
    return request.tenantContext;
  },
);
