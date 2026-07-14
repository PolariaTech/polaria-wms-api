import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequireTenantContextInterceptor } from '../interceptors/require-tenant-context.interceptor';
import { TenantModule } from '../tenant/tenant.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { SensitiveWriteGuard } from './sensitive-write.guard';
import { TenantGuard } from './tenant.guard';

@Global()
@Module({
  imports: [TenantModule],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    TenantGuard,
    SensitiveWriteGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequireTenantContextInterceptor,
    },
  ],
  exports: [
    JwtAuthGuard,
    RolesGuard,
    TenantGuard,
    SensitiveWriteGuard,
    TenantModule,
  ],
})
export class GuardsModule {}
