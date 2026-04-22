import { SetMetadata } from '@nestjs/common';
import { PlatformRole } from '../users/enums/platform-role.enum';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: PlatformRole[]) =>
  SetMetadata(ROLES_KEY, roles);
