import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantSchemaLocator } from './tenant-schema.locator';

@Global()
@Module({
  providers: [PrismaService, TenantSchemaLocator],
  exports: [PrismaService, TenantSchemaLocator],
})
export class DatabaseModule {}
