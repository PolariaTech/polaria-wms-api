import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { WmsRol } from '../../generated/prisma/client';
import type { AuthenticatedRequest } from '../tenant/tenant-context.interface';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WmsRol[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantContext = request.tenantContext;

    if (!tenantContext) {
      throw new ForbiddenException('Contexto de tenant requerido');
    }

    if (!requiredRoles.includes(tenantContext.idRol)) {
      throw new ForbiddenException('No tiene permisos para esta operación');
    }

    return true;
  }
}
