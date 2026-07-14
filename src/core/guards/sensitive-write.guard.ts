import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  PERMISSION,
  canInventoryWrite,
} from '../../shared/constants/permissions';
import type { AuthenticatedRequest } from '../tenant/tenant-context.interface';

/**
 * Guard para endpoints de escritura sensible (inventario, contadores, warehouse_state).
 * Configurador: bypass. Resto: solo roles con inventory:write.
 */
@Injectable()
export class SensitiveWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantContext = request.tenantContext;

    if (!tenantContext) {
      throw new ForbiddenException('Contexto de tenant requerido');
    }

    if (!canInventoryWrite(tenantContext.idRol)) {
      throw new ForbiddenException(
        `No tiene permisos para ${PERMISSION.INVENTORY_WRITE}`,
      );
    }

    return true;
  }
}
