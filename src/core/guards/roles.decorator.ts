import { SetMetadata } from '@nestjs/common';
import type { WmsRol } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: WmsRol[]) => SetMetadata(ROLES_KEY, roles);
