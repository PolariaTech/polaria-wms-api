import { SetMetadata } from '@nestjs/common';

export const REQUIRE_TENANT_CONTEXT_KEY = 'requireTenantContext';

/** Marca rutas que exigen TenantGuard (red de seguridad para módulos futuros). */
export const RequireTenantContext = () =>
  SetMetadata(REQUIRE_TENANT_CONTEXT_KEY, true);
