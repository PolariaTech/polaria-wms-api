import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../tenant/tenant-context.interface';

/** Rate limit por IP; si hay tenant, también por empresa (anti noisy-neighbor). */
@Injectable()
export class PolariaThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request & AuthenticatedRequest;
    const ip =
      (request.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      request.ip ??
      'unknown';
    const empresa = request.tenantContext?.codigoEmpresa;

    if (empresa) {
      return `tenant:${empresa}:${ip}`;
    }

    return `ip:${ip}`;
  }
}
