import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PlatformRole } from '../users/enums/platform-role.enum';
import { JwtUser } from './jwt-user.type';
import { UsersService } from '../users/users.service';

type JwtPayload = {
  sub: number;
  email: string;
  name: string;
  platformRole: PlatformRole;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    const jwtSecret =
      process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0
        ? process.env.JWT_SECRET
        : process.env.NODE_ENV === 'production'
          ? null
          : 'dev-secret-change-me';

    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be defined in production');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    if (
      !payload?.sub ||
      !payload?.email ||
      !payload?.name ||
      !payload?.platformRole
    ) {
      throw new UnauthorizedException('Jeton invalide');
    }

    const user = await this.usersService.findSafeById(payload.sub);

    if (user.isSuspended) {
      throw new UnauthorizedException('Compte suspendu');
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      platformRole: user.platformRole,
    };
  }
}
