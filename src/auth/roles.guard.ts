import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { PlatformRole } from '../users/enums/platform-role.enum';
import { JwtUser } from './jwt-user.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PlatformRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;

    if (!user || !user.platformRole) {
      throw new ForbiddenException('Rôle utilisateur introuvable');
    }

    if (!requiredRoles.includes(user.platformRole)) {
      throw new ForbiddenException('Accès refusé');
    }

    return true;
  }
}
