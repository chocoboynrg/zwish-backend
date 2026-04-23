import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { User } from './user.entity';
import { PlatformRole } from './enums/platform-role.enum';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AuditService } from '../audit/audit.service';
import { Reservation } from '../reservations/reservation.entity';
import { Payment } from '../payments/payment.entity';
import { Contribution } from '../contributions/contribution.entity';
import { Event } from '../events/event.entity';
import { AuditLog } from '../audit/audit-log.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly auditService: AuditService,
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,

    @InjectRepository(Contribution)
    private readonly contributionsRepository: Repository<Contribution>,

    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,

    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,

    @InjectRepository(AuditLog)
    private readonly auditLogsRepository: Repository<AuditLog>,
  ) {}

  async getAllUsers() {
    return this.usersRepository.find({
      select: [
        'id',
        'name',
        'email',
        'platformRole',
        'phoneNumber',
        'emailVerifiedAt',
      ],
      order: { id: 'DESC' },
    });
  }

  async createUser(name: string, email: string) {
    const user = this.usersRepository.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: '',
      phoneNumber: null,
      emailVerifiedAt: null,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    });

    return this.usersRepository.save(user);
  }

  async createUserWithPassword(
    name: string,
    email: string,
    passwordHash: string,
    normalizedPhone?: string | null,
  ) {
    const user = this.usersRepository.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      phoneNumber: normalizedPhone?.trim() || null,
      emailVerifiedAt: null,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    });

    return this.usersRepository.save(user);
  }

  async findByEmailWithPassword(email: string) {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .addSelect('user.emailVerificationTokenHash')
      .addSelect('user.emailVerificationExpiresAt')
      .addSelect('user.isSuspended')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async findSafeById(id: number) {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: [
        'id',
        'name',
        'email',
        'platformRole',
        'phoneNumber',
        'emailVerifiedAt',
        'isSuspended',
        'suspendedAt',
        'suspensionReason',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    return user;
  }

  async findByIdWithVerificationFields(id: number) {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.emailVerificationTokenHash')
      .addSelect('user.emailVerificationExpiresAt')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    return user;
  }

  async findByVerificationTokenHash(tokenHash: string) {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.emailVerificationTokenHash')
      .addSelect('user.emailVerificationExpiresAt')
      .where('user.emailVerificationTokenHash = :tokenHash', { tokenHash })
      .getOne();
  }

  async save(user: User) {
    return this.usersRepository.save(user);
  }

  async updateProfile(
    userId: number,
    data: { name?: string; phoneNumber?: string },
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (data.name !== undefined) {
      user.name = data.name.trim();
    }

    if (data.phoneNumber !== undefined) {
      user.phoneNumber = data.phoneNumber.trim();
    }

    await this.usersRepository.save(user);

    return this.findSafeById(userId);
  }

  async getAdminUsers(query: AdminUsersQueryDto) {
    const {
      page = 1,
      limit = 20,
      role,
      verified,
      hasPhone,
      suspended,
      search,
      sortBy = 'createdAt',
      order = 'DESC',
    } = query;

    const allowedSortFields = new Set([
      'createdAt',
      'updatedAt',
      'name',
      'email',
      'platformRole',
    ]);

    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.usersRepository.createQueryBuilder('user');

    if (role) {
      qb.andWhere('user.platformRole = :role', { role });
    }

    if (verified !== undefined) {
      if (verified) {
        qb.andWhere('user.emailVerifiedAt IS NOT NULL');
      } else {
        qb.andWhere('user.emailVerifiedAt IS NULL');
      }
    }

    if (hasPhone !== undefined) {
      if (hasPhone) {
        qb.andWhere(
          `user.phoneNumber IS NOT NULL AND TRIM(user.phoneNumber) <> ''`,
        );
      } else {
        qb.andWhere(`user.phoneNumber IS NULL OR TRIM(user.phoneNumber) = ''`);
      }
    }

    if (suspended !== undefined) {
      qb.andWhere('user.isSuspended = :suspended', { suspended });
    }

    if (search) {
      qb.andWhere(`(user.name ILIKE :search OR user.email ILIKE :search)`, {
        search: `%${search}%`,
      });
    }

    qb.orderBy(`user.${safeSortBy}`, safeOrder as 'ASC' | 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [users, total] = await qb.getManyAndCount();

    const items = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      platformRole: u.platformRole,
      phoneNumber: u.phoneNumber,
      emailVerifiedAt: u.emailVerifiedAt,
      isSuspended: u.isSuspended,
      suspendedAt: u.suspendedAt,
      suspensionReason: u.suspensionReason,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return {
      items,
      total,
      summary: {
        page,
        limit,
        totalCount: total,
        verifiedCount: items.filter((u) => !!u.emailVerifiedAt).length,
        unverifiedCount: items.filter((u) => !u.emailVerifiedAt).length,
        suspendedCount: items.filter((u) => u.isSuspended).length,
        activeCount: items.filter((u) => !u.isSuspended).length,
        withPhoneCount: items.filter(
          (u) => !!u.phoneNumber && u.phoneNumber.trim().length > 0,
        ).length,
        withoutPhoneCount: items.filter(
          (u) => !u.phoneNumber || u.phoneNumber.trim().length === 0,
        ).length,
      },
    };
  }

  async getAdminUserById(id: number) {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Ces requêtes utilisent les relations TypeORM — OK
    const organizedEvents = await this.eventsRepository
      .createQueryBuilder('event')
      .leftJoin('event.organizer', 'organizer')
      .where('organizer.id = :userId', { userId: id })
      .orderBy('event.id', 'DESC')
      .limit(10)
      .getMany();

    const contributions = await this.contributionsRepository.find({
      where: { contributor: { id } },
      relations: ['event', 'wishlistItem'],
      order: { id: 'DESC' },
      take: 10,
    });

    const payments = await this.paymentsRepository.find({
      where: { payer: { id } },
      relations: ['contribution', 'contribution.event'],
      order: { id: 'DESC' },
      take: 10,
    });

    const reservations = await this.reservationsRepository.find({
      where: { reservedBy: { id } },
      relations: ['event', 'wishlistItem'],
      order: { id: 'DESC' },
      take: 10,
    });

    // ✅ CORRECTIF : utiliser 4 COUNT séparés avec .from('users', 'u') comme ancre
    // ou passer par les repositories directement — plus simple et fiable
    const organizedEventsCount = await this.eventsRepository
      .createQueryBuilder('event')
      .leftJoin('event.organizer', 'organizer')
      .where('organizer.id = :userId', { userId: id })
      .getCount();

    const contributionsCount = await this.contributionsRepository
      .createQueryBuilder('c')
      .where('c.contributor_user_id = :userId', { userId: id })
      .getCount();

    const paymentsCount = await this.paymentsRepository
      .createQueryBuilder('p')
      .where('p.payer_user_id = :userId', { userId: id })
      .getCount();

    const reservationsCount = await this.reservationsRepository
      .createQueryBuilder('r')
      .where('r.reserved_by_user_id = :userId', { userId: id })
      .getCount();

    const auditLogs = await this.auditLogsRepository
      .createQueryBuilder('audit')
      .where('audit.userId = :userId', { userId: id })
      .orWhere(
        new Brackets((qb) => {
          qb.where('audit.entityType = :entityType', {
            entityType: 'User',
          }).andWhere('audit.entityId = :entityId', { entityId: id });
        }),
      )
      .orderBy('audit.createdAt', 'DESC')
      .limit(20)
      .getMany();

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      platformRole: user.platformRole,
      phoneNumber: user.phoneNumber,
      emailVerifiedAt: user.emailVerifiedAt,
      isSuspended: user.isSuspended,
      suspendedAt: user.suspendedAt,
      suspensionReason: user.suspensionReason,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,

      summary: {
        organizedEventsCount,
        contributionsCount,
        paymentsCount,
        reservationsCount,
      },

      organizedEvents: organizedEvents.map((event) => ({
        id: event.id,
        title: event.title,
        eventDate: event.eventDate,
        description: event.description ?? null,
        shareToken: event.shareToken ?? null,
      })),

      latestAuditLogs: auditLogs.map((log) => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
        ip: log.ip,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      })),

      latestContributions: contributions.map((contribution) => ({
        id: contribution.id,
        amount: Number(contribution.amount),
        currencyCode: contribution.currencyCode,
        status: contribution.status,
        message: contribution.message,
        confirmedAt: contribution.confirmedAt,
        createdAt: contribution.createdAt,
        event: contribution.event
          ? {
              id: contribution.event.id,
              title: contribution.event.title,
              eventDate: contribution.event.eventDate,
            }
          : null,
        wishlistItem: contribution.wishlistItem
          ? {
              id: contribution.wishlistItem.id,
              name: contribution.wishlistItem.name,
            }
          : null,
      })),

      latestPayments: payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        currencyCode: payment.currencyCode,
        status: payment.status,
        provider: payment.provider,
      })),

      latestReservations: reservations.map((reservation) => ({
        id: reservation.id,
        status: reservation.status,
        event: reservation.event
          ? { id: reservation.event.id, title: reservation.event.title }
          : null,
        wishlistItem: reservation.wishlistItem
          ? {
              id: reservation.wishlistItem.id,
              name: reservation.wishlistItem.name,
            }
          : null,
      })),
    };
  }

  async updateUserRole(
    targetUserId: number,
    actor: { userId: number; platformRole: PlatformRole },
    nextRole: PlatformRole,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (actor.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Seul un SUPER_ADMIN peut modifier les rôles',
      );
    }

    if (user.id === actor.userId) {
      throw new BadRequestException(
        'Vous ne pouvez pas modifier votre propre rôle',
      );
    }

    if (user.platformRole === PlatformRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Le rôle d’un SUPER_ADMIN ne peut pas être modifié par cette action',
      );
    }

    if (user.platformRole === nextRole) {
      return user;
    }

    const previousRole = user.platformRole;
    user.platformRole = nextRole;

    const saved = await this.usersRepository.save(user);

    await this.auditService.log({
      userId: actor.userId,
      action: 'USER_ROLE_UPDATED',
      entityType: 'User',
      entityId: saved.id,
      metadata: {
        targetUserId: saved.id,
        previousRole,
        newRole: nextRole,
      },
    });

    return saved;
  }

  async suspendUser(
    _targetUserId: number,
    _actor: { userId: number; platformRole: PlatformRole },
    reason?: string,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: _targetUserId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (user.isSuspended) {
      return user;
    }

    if (user.id === _actor.userId) {
      throw new BadRequestException(
        'Vous ne pouvez pas suspendre votre propre compte',
      );
    }

    if (user.platformRole === PlatformRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Un SUPER_ADMIN ne peut pas être suspendu par cette action',
      );
    }

    if (
      _actor.platformRole === PlatformRole.ADMIN &&
      user.platformRole === PlatformRole.ADMIN
    ) {
      throw new BadRequestException(
        'Un ADMIN ne peut pas suspendre un autre ADMIN',
      );
    }

    user.isSuspended = true;
    user.suspendedAt = new Date();
    user.suspensionReason =
      reason?.trim() || 'Compte suspendu par un administrateur';

    const saved = await this.usersRepository.save(user);

    await this.auditService.log({
      userId: _actor.userId,
      action: 'USER_SUSPENDED',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        targetUserId: user.id,
        targetRole: user.platformRole,
        reason: saved.suspensionReason,
      },
    });

    return saved;
  }

  async unsuspendUser(
    _targetUserId: number,
    _actor: { userId: number; platformRole: PlatformRole },
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: _targetUserId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (!user.isSuspended) {
      return user;
    }

    if (
      _actor.platformRole === PlatformRole.ADMIN &&
      user.platformRole === PlatformRole.ADMIN
    ) {
      throw new BadRequestException(
        'Un ADMIN ne peut pas réactiver un autre ADMIN',
      );
    }

    if (user.platformRole === PlatformRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Un SUPER_ADMIN ne peut pas être réactivé par cette action',
      );
    }

    user.isSuspended = false;
    user.suspendedAt = null;
    user.suspensionReason = null;

    const saved = await this.usersRepository.save(user);

    await this.auditService.log({
      userId: _actor.userId,
      action: 'USER_UNSUSPENDED',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        targetUserId: user.id,
        targetRole: user.platformRole,
      },
    });

    return saved;
  }

  async exportAdminUsersCsv(query: AdminUsersQueryDto) {
    const {
      role,
      verified,
      hasPhone,
      suspended,
      search,
      sortBy = 'createdAt',
      order = 'DESC',
    } = query;

    const allowedSortFields = new Set([
      'createdAt',
      'updatedAt',
      'name',
      'email',
      'platformRole',
    ]);

    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.usersRepository.createQueryBuilder('user');

    if (role) {
      qb.andWhere('user.platformRole = :role', { role });
    }

    if (verified !== undefined) {
      if (verified) {
        qb.andWhere('user.emailVerifiedAt IS NOT NULL');
      } else {
        qb.andWhere('user.emailVerifiedAt IS NULL');
      }
    }

    if (hasPhone !== undefined) {
      if (hasPhone) {
        qb.andWhere(
          `user.phoneNumber IS NOT NULL AND TRIM(user.phoneNumber) <> ''`,
        );
      } else {
        qb.andWhere(`user.phoneNumber IS NULL OR TRIM(user.phoneNumber) = ''`);
      }
    }

    if (suspended !== undefined) {
      qb.andWhere('user.isSuspended = :suspended', { suspended });
    }

    if (search) {
      qb.andWhere('(user.name ILIKE :search OR user.email ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy(`user.${safeSortBy}`, safeOrder as 'ASC' | 'DESC');

    const users = await qb.getMany();

    const escapeCsv = (value: unknown): string => {
      if (value === null || value === undefined) {
        return '';
      }

      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    };

    const headers = [
      'id',
      'name',
      'email',
      'platformRole',
      'phoneNumber',
      'emailVerifiedAt',
      'isSuspended',
      'suspendedAt',
      'suspensionReason',
      'createdAt',
      'updatedAt',
    ];

    const rows = users.map((user) =>
      [
        user.id,
        user.name,
        user.email,
        user.platformRole,
        user.phoneNumber,
        user.emailVerifiedAt?.toISOString() ?? '',
        user.isSuspended,
        user.suspendedAt?.toISOString() ?? '',
        user.suspensionReason ?? '',
        user.createdAt?.toISOString() ?? '',
        user.updatedAt?.toISOString() ?? '',
      ]
        .map(escapeCsv)
        .join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  async logAdminUsersExport(
    actor: { userId: number; platformRole: PlatformRole },
    query: AdminUsersQueryDto,
  ) {
    await this.auditService.log({
      userId: actor.userId,
      action: 'USERS_EXPORTED',
      entityType: 'User',
      metadata: {
        actorRole: actor.platformRole,
        filters: query,
      },
    });
  }
}
