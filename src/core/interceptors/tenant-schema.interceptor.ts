import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedRequest } from '../tenant/tenant-context.interface';

/**
 * Tras TenantGuard: fija search_path del request al schema de la empresa.
 * Configurador / sin schema_name → public (legacy).
 */
@Injectable()
export class TenantSchemaInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const schemaName = request.tenantContext?.schemaName ?? null;

    return from(
      this.prisma.runWithSchema(schemaName, () => lastValueFrom(next.handle())),
    );
  }
}
