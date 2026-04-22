import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { PlatformRole } from '../users/enums/platform-role.enum';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  async register(
    name: string,
    email: string,
    password: string,
    phone?: string,
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    const normalizedPhone = phone?.trim() ? phone.trim() : null;

    const existingUser =
      await this.usersService.findByEmailWithPassword(normalizedEmail);

    if (existingUser) {
      throw new BadRequestException('Cet email est déjà utilisé');
    }

    if (!normalizedName) {
      throw new BadRequestException('Le nom est obligatoire');
    }

    if (!password || password.length < 6) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins 6 caractères',
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.usersService.createUserWithPassword(
      normalizedName,
      normalizedEmail,
      passwordHash,
      normalizedPhone,
    );

    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenHash = createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const userWithVerification =
      await this.usersService.findByIdWithVerificationFields(user.id);

    userWithVerification.emailVerificationTokenHash = verificationTokenHash;
    userWithVerification.emailVerificationExpiresAt = verificationExpiresAt;
    userWithVerification.emailVerifiedAt = null;

    await this.usersService.save(userWithVerification);

    try {
      await this.mailService.sendVerificationEmail({
        to: user.email,
        name: user.name,
        verificationToken,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send verification email on register | userId=${user.id} error=${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      platformRole: user.platformRole as PlatformRole,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    await this.auditService.log({
      userId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email },
    });

    return {
      message: 'Inscription réussie. Vérifiez votre email.',
      accessToken,
      verificationExpiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber ?? null,
        platformRole: user.platformRole,
        emailVerified: false,
        emailVerifiedAt: null,
      },
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user =
      await this.usersService.findByEmailWithPassword(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe invalide');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe invalide');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      platformRole: user.platformRole as PlatformRole,
    };

    if (user.isSuspended) {
      throw new UnauthorizedException('Ce compte est suspendu');
    }

    const accessToken = await this.jwtService.signAsync(payload);

    await this.auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
    });

    return {
      message: user.emailVerifiedAt
        ? 'Connexion réussie'
        : 'Connexion réussie. Email non encore vérifié.',
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber ?? null,
        platformRole: user.platformRole,
        emailVerified: !!user.emailVerifiedAt,
        emailVerifiedAt: user.emailVerifiedAt ?? null,
      },
    };
  }

  async verifyEmail(token: string) {
    const normalizedToken = token.trim();

    if (!normalizedToken) {
      throw new BadRequestException('Token de vérification requis');
    }

    const tokenHash = createHash('sha256')
      .update(normalizedToken)
      .digest('hex');

    const user = await this.usersService.findByVerificationTokenHash(tokenHash);

    if (!user) {
      throw new BadRequestException('Token de vérification invalide');
    }

    if (user.emailVerifiedAt) {
      return {
        message: 'Email déjà vérifié',
        user: {
          id: user.id,
          email: user.email,
          emailVerified: true,
          emailVerifiedAt: user.emailVerifiedAt,
        },
      };
    }

    if (
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Token de vérification expiré');
    }

    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;

    await this.usersService.save(user);

    await this.auditService.log({
      userId: user.id,
      action: 'EMAIL_VERIFIED',
      entityType: 'User',
      entityId: user.id,
    });

    return {
      message: 'Email vérifié avec succès',
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }

  async resendVerification(email: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    if (user.emailVerifiedAt) {
      return {
        message: 'Cet email est déjà vérifié',
      };
    }

    const userWithVerification =
      await this.usersService.findByIdWithVerificationFields(user.id);

    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenHash = createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    userWithVerification.emailVerificationTokenHash = verificationTokenHash;
    userWithVerification.emailVerificationExpiresAt = verificationExpiresAt;

    await this.usersService.save(userWithVerification);

    try {
      await this.mailService.sendVerificationEmail({
        to: user.email,
        name: user.name,
        verificationToken,
      });
    } catch (error) {
      this.logger.error(
        `Failed to resend verification email | userId=${user.id} error=${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    return {
      message: 'Nouveau mail de vérification envoyé',
      verificationExpiresAt,
    };
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findSafeById(userId);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber ?? null,
      platformRole: user.platformRole,
      emailVerified: !!user.emailVerifiedAt,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
    };
  }
}
