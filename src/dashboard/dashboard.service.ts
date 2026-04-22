import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';
import { EventParticipant } from '../participants/event-participant.entity';
import { Contribution } from '../contributions/contribution.entity';
import { Payment } from '../payments/payment.entity';

import { ParticipantStatus } from '../participants/enums/participant-status.enum';
import { ContributionStatus } from '../contributions/enums/contribution-status.enum';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import { PlatformRole } from '../users/enums/platform-role.enum';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,

    @InjectRepository(EventParticipant)
    private readonly participantsRepository: Repository<EventParticipant>,

    @InjectRepository(Contribution)
    private readonly contributionsRepository: Repository<Contribution>,

    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
  ) {}

  async getMyDashboard(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const organizedEvents = await this.eventsRepository
      .createQueryBuilder('event')
      .leftJoin('event.organizer', 'organizer')
      .where('organizer.id = :userId', { userId })
      .orderBy('event.id', 'DESC')
      .getMany();

    const organizedEventIds = new Set(organizedEvents.map((event) => event.id));
    const organizedEventsCount = organizedEvents.length;

    const participations = await this.participantsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: ['event', 'user'],
    });

    const joinedEvents = participations
      .filter(
        (participant) =>
          participant.status === ParticipantStatus.ACCEPTED &&
          participant.event &&
          !organizedEventIds.has(participant.event.id),
      )
      .map((participant) => participant.event);

    const participatingEventsCount = joinedEvents.length;

    const contributionsRaw = await this.contributionsRepository
      .createQueryBuilder('contribution')
      .select('COUNT(contribution.id)', 'totalContributions')
      .addSelect(
        `SUM(CASE WHEN contribution.status = :confirmedStatus THEN 1 ELSE 0 END)`,
        'confirmedContributions',
      )
      .addSelect(
        `SUM(CASE WHEN contribution.status = :awaitingStatus THEN 1 ELSE 0 END)`,
        'awaitingPaymentContributions',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN contribution.status = :confirmedStatus THEN contribution.amount ELSE 0 END), 0)`,
        'confirmedAmount',
      )
      .where('contribution.contributor_user_id = :userId', { userId })
      .setParameters({
        confirmedStatus: ContributionStatus.CONFIRMED,
        awaitingStatus: ContributionStatus.AWAITING_PAYMENT,
      })
      .getRawOne<{
        totalContributions: string;
        confirmedContributions: string;
        awaitingPaymentContributions: string;
        confirmedAmount: string;
      }>();

    const paymentsRaw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select('COUNT(payment.id)', 'totalPayments')
      .addSelect(
        `SUM(CASE WHEN payment.status = :initiatedStatus THEN 1 ELSE 0 END)`,
        'initiatedPayments',
      )
      .addSelect(
        `SUM(CASE WHEN payment.status = :succeededStatus THEN 1 ELSE 0 END)`,
        'succeededPayments',
      )
      .addSelect(
        `SUM(CASE WHEN payment.status = :failedStatus THEN 1 ELSE 0 END)`,
        'failedPayments',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN payment.status = :succeededStatus THEN payment.amount ELSE 0 END), 0)`,
        'succeededAmount',
      )
      .where('payment.payer_user_id = :userId', { userId })
      .setParameters({
        initiatedStatus: PaymentStatus.INITIATED,
        succeededStatus: PaymentStatus.SUCCEEDED,
        failedStatus: PaymentStatus.FAILED,
      })
      .getRawOne<{
        totalPayments: string;
        initiatedPayments: string;
        succeededPayments: string;
        failedPayments: string;
        succeededAmount: string;
      }>();

    const latestContributionsRaw = await this.contributionsRepository
      .createQueryBuilder('contribution')
      .leftJoin('contribution.event', 'event')
      .leftJoin('contribution.wishlistItem', 'wishlistItem')
      .select('contribution.id', 'id')
      .addSelect('contribution.amount', 'amount')
      .addSelect('contribution.currencyCode', 'currencyCode')
      .addSelect('contribution.status', 'status')
      .addSelect('contribution.isAnonymous', 'isAnonymous')
      .addSelect('contribution.message', 'message')
      .addSelect('contribution.confirmedAt', 'confirmedAt')
      .addSelect('contribution.createdAt', 'createdAt')
      .addSelect('event.id', 'eventId')
      .addSelect('event.title', 'eventTitle')
      .addSelect('wishlistItem.id', 'wishlistItemId')
      .addSelect('wishlistItem.name', 'wishlistItemName')
      .where('contribution.contributor_user_id = :userId', { userId })
      .orderBy('contribution.id', 'DESC')
      .limit(5)
      .getRawMany<{
        id: string;
        amount: string;
        currencyCode: string;
        status: string;
        isAnonymous: boolean | string;
        message: string | null;
        confirmedAt: Date | null;
        createdAt: Date;
        eventId: string | null;
        eventTitle: string | null;
        wishlistItemId: string | null;
        wishlistItemName: string | null;
      }>();

    const latestPaymentsRaw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.contribution', 'contribution')
      .leftJoin('contribution.event', 'event')
      .select('payment.id', 'id')
      .addSelect('payment.amount', 'amount')
      .addSelect('payment.currencyCode', 'currencyCode')
      .addSelect('payment.provider', 'provider')
      .addSelect('payment.paymentMethod', 'paymentMethod')
      .addSelect('payment.status', 'status')
      .addSelect('payment.providerReference', 'providerReference')
      .addSelect('payment.providerTransactionId', 'providerTransactionId')
      .addSelect('payment.confirmedAt', 'confirmedAt')
      .addSelect('payment.failedAt', 'failedAt')
      .addSelect('payment.createdAt', 'createdAt')
      .addSelect('event.id', 'eventId')
      .addSelect('event.title', 'eventTitle')
      .where('payment.payer_user_id = :userId', { userId })
      .orderBy('payment.id', 'DESC')
      .limit(5)
      .getRawMany<{
        id: string;
        amount: string;
        currencyCode: string;
        provider: string;
        paymentMethod: string;
        status: string;
        providerReference: string | null;
        providerTransactionId: string | null;
        confirmedAt: Date | null;
        failedAt: Date | null;
        createdAt: Date;
        eventId: string | null;
        eventTitle: string | null;
      }>();

    return {
      organizedEvents: organizedEvents.map((event) => ({
        id: event.id,
        title: event.title,
        eventDate: event.eventDate,
        description: event.description ?? null,
      })),

      joinedEvents: joinedEvents.map((event) => ({
        id: event.id,
        title: event.title,
        eventDate: event.eventDate,
        description: event.description ?? null,
      })),

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },

      summary: {
        organizedEventsCount,
        participatingEventsCount,

        totalContributions: Number(contributionsRaw?.totalContributions ?? 0),
        confirmedContributions: Number(
          contributionsRaw?.confirmedContributions ?? 0,
        ),
        awaitingPaymentContributions: Number(
          contributionsRaw?.awaitingPaymentContributions ?? 0,
        ),
        confirmedContributionsAmount: Number(
          contributionsRaw?.confirmedAmount ?? 0,
        ),

        totalPayments: Number(paymentsRaw?.totalPayments ?? 0),
        initiatedPayments: Number(paymentsRaw?.initiatedPayments ?? 0),
        succeededPayments: Number(paymentsRaw?.succeededPayments ?? 0),
        failedPayments: Number(paymentsRaw?.failedPayments ?? 0),
        succeededPaymentsAmount: Number(paymentsRaw?.succeededAmount ?? 0),
      },

      latestContributions: latestContributionsRaw.map((row) => ({
        id: Number(row.id),
        amount: Number(row.amount ?? 0),
        currencyCode: row.currencyCode,
        status: row.status,
        isAnonymous:
          row.isAnonymous === true || String(row.isAnonymous) === 'true',
        message: row.message,
        confirmedAt: row.confirmedAt,
        createdAt: row.createdAt,
        event: row.eventId
          ? {
              id: Number(row.eventId),
              title: row.eventTitle,
            }
          : null,
        wishlistItem: row.wishlistItemId
          ? {
              id: Number(row.wishlistItemId),
              name: row.wishlistItemName,
            }
          : null,
      })),

      latestPayments: latestPaymentsRaw.map((row) => ({
        id: Number(row.id),
        amount: Number(row.amount ?? 0),
        currencyCode: row.currencyCode,
        provider: row.provider,
        paymentMethod: row.paymentMethod,
        status: row.status,
        providerReference: row.providerReference,
        providerTransactionId: row.providerTransactionId,
        confirmedAt: row.confirmedAt,
        failedAt: row.failedAt,
        createdAt: row.createdAt,
        event: row.eventId
          ? {
              id: Number(row.eventId),
              title: row.eventTitle,
            }
          : null,
      })),
    };
  }

  async getAdminDashboard() {
    const totalUsers = await this.usersRepository.count();

    const usersRaw = await this.usersRepository
      .createQueryBuilder('user')
      .select('COUNT(user.id)', 'totalUsers')
      .addSelect(
        `SUM(CASE WHEN user.emailVerifiedAt IS NOT NULL THEN 1 ELSE 0 END)`,
        'verifiedUsers',
      )
      .addSelect(
        `SUM(CASE WHEN user.emailVerifiedAt IS NULL THEN 1 ELSE 0 END)`,
        'unverifiedUsers',
      )
      .addSelect(
        `SUM(CASE WHEN user.phoneNumber IS NOT NULL AND TRIM(user.phoneNumber) <> '' THEN 1 ELSE 0 END)`,
        'usersWithPhone',
      )
      .addSelect(
        `SUM(CASE WHEN user.phoneNumber IS NULL OR TRIM(user.phoneNumber) = '' THEN 1 ELSE 0 END)`,
        'usersWithoutPhone',
      )
      .addSelect(
        `SUM(CASE WHEN user.platformRole = :userRole THEN 1 ELSE 0 END)`,
        'standardUsers',
      )
      .addSelect(
        `SUM(CASE WHEN user.platformRole = :adminRole THEN 1 ELSE 0 END)`,
        'admins',
      )
      .addSelect(
        `SUM(CASE WHEN user.platformRole = :superAdminRole THEN 1 ELSE 0 END)`,
        'superAdmins',
      )
      .addSelect(
        `SUM(CASE WHEN user.id IS NOT NULL AND user.createdAt >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)`,
        'newUsersLast7Days',
      )
      .addSelect(
        `SUM(CASE WHEN user.id IS NOT NULL AND user.createdAt >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END)`,
        'newUsersLast30Days',
      )
      .setParameters({
        userRole: PlatformRole.USER,
        adminRole: PlatformRole.ADMIN,
        superAdminRole: PlatformRole.SUPER_ADMIN,
      })
      .getRawOne<{
        totalUsers: string;
        verifiedUsers: string;
        unverifiedUsers: string;
        usersWithPhone: string;
        usersWithoutPhone: string;
        standardUsers: string;
        admins: string;
        superAdmins: string;
        newUsersLast7Days: string;
        newUsersLast30Days: string;
      }>();

    const totalEvents = await this.eventsRepository.count();

    const totalWishlistsRaw = await this.eventsRepository.manager
      .createQueryBuilder()
      .select('COUNT(w.id)', 'totalWishlists')
      .from('wishlists', 'w')
      .getRawOne<{ totalWishlists: string }>();

    const totalWishlistItemsRaw = await this.eventsRepository.manager
      .createQueryBuilder()
      .select('COUNT(wi.id)', 'totalWishlistItems')
      .from('wishlist_items', 'wi')
      .getRawOne<{ totalWishlistItems: string }>();

    const contributionsRaw = await this.contributionsRepository
      .createQueryBuilder('contribution')
      .select('COUNT(contribution.id)', 'totalContributions')
      .addSelect(
        `SUM(CASE WHEN contribution.status = :confirmedStatus THEN 1 ELSE 0 END)`,
        'confirmedContributions',
      )
      .addSelect(
        `SUM(CASE WHEN contribution.status = :awaitingStatus THEN 1 ELSE 0 END)`,
        'awaitingPaymentContributions',
      )
      .addSelect(
        `SUM(CASE WHEN contribution.status = :failedStatus THEN 1 ELSE 0 END)`,
        'failedContributions',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN contribution.status = :confirmedStatus THEN contribution.amount ELSE 0 END), 0)`,
        'confirmedAmount',
      )
      .setParameters({
        confirmedStatus: ContributionStatus.CONFIRMED,
        awaitingStatus: ContributionStatus.AWAITING_PAYMENT,
        failedStatus: ContributionStatus.FAILED,
      })
      .getRawOne<{
        totalContributions: string;
        confirmedContributions: string;
        awaitingPaymentContributions: string;
        failedContributions: string;
        confirmedAmount: string;
      }>();

    const paymentsRaw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select('COUNT(payment.id)', 'totalPayments')
      .addSelect(
        `SUM(CASE WHEN payment.status = :initiatedStatus THEN 1 ELSE 0 END)`,
        'initiatedPayments',
      )
      .addSelect(
        `SUM(CASE WHEN payment.status = :succeededStatus THEN 1 ELSE 0 END)`,
        'succeededPayments',
      )
      .addSelect(
        `SUM(CASE WHEN payment.status = :failedStatus THEN 1 ELSE 0 END)`,
        'failedPayments',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN payment.status = :succeededStatus THEN payment.amount ELSE 0 END), 0)`,
        'succeededAmount',
      )
      .setParameters({
        initiatedStatus: PaymentStatus.INITIATED,
        succeededStatus: PaymentStatus.SUCCEEDED,
        failedStatus: PaymentStatus.FAILED,
      })
      .getRawOne<{
        totalPayments: string;
        initiatedPayments: string;
        succeededPayments: string;
        failedPayments: string;
        succeededAmount: string;
      }>();

    const conversionRaw = await this.contributionsRepository
      .createQueryBuilder('c')
      .select('COUNT(c.id)', 'total')
      .addSelect(
        `SUM(CASE WHEN c.status = :confirmed THEN 1 ELSE 0 END)`,
        'confirmed',
      )
      .setParameters({
        confirmed: ContributionStatus.CONFIRMED,
      })
      .getRawOne<{ total: string; confirmed: string }>() || { total: '0', confirmed: '0' };

    const conversionRate =
      Number(conversionRaw.confirmed ?? 0) /
      Math.max(Number(conversionRaw.total ?? 1), 1);

    const revenueByDayRaw = await this.paymentsRepository
      .createQueryBuilder('p')
      .select(`DATE(p.confirmedAt)`, 'date')
      .addSelect('SUM(p.amount)', 'amount')
      .where('p.status = :status', {
        status: PaymentStatus.SUCCEEDED,
      })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .limit(30)
      .getRawMany<{ date: string; amount: string }>();

    const revenueByDay = revenueByDayRaw.map((r) => ({
      date: r.date,
      amount: Number(r.amount ?? 0),
    }));

    const topEventsRaw = await this.contributionsRepository
      .createQueryBuilder('c')
      .leftJoin('c.event', 'event')
      .select('event.id', 'eventId')
      .addSelect('event.title', 'eventTitle')
      .addSelect('SUM(c.amount)', 'totalAmount')
      .where('c.status = :status', {
        status: ContributionStatus.CONFIRMED,
      })
      .groupBy('event.id')
      .addGroupBy('event.title')
      .orderBy('totalAmount', 'DESC')
      .limit(5)
      .getRawMany<{
        eventId: string;
        eventTitle: string;
        totalAmount: string;
      }>();

    const topEvents = topEventsRaw.map((e) => ({
      id: Number(e.eventId),
      title: e.eventTitle,
      totalAmount: Number(e.totalAmount ?? 0),
    }));

    const anomaliesRaw = await this.paymentsRepository
      .createQueryBuilder('p')
      .leftJoin('p.contribution', 'c')
      .select('COUNT(p.id)', 'count')
      .where(
        `(p.status = :success AND c.status != :confirmed)
     OR (p.status != :success AND c.status = :confirmed)`,
        {
          success: PaymentStatus.SUCCEEDED,
          confirmed: ContributionStatus.CONFIRMED,
        },
      )
      .getRawOne<{ count: string }>();

    const latestContributionsRaw = await this.contributionsRepository
      .createQueryBuilder('contribution')
      .leftJoin('contribution.contributor', 'contributor')
      .leftJoin('contribution.event', 'event')
      .leftJoin('contribution.wishlistItem', 'wishlistItem')
      .select('contribution.id', 'id')
      .addSelect('contribution.amount', 'amount')
      .addSelect('contribution.currencyCode', 'currencyCode')
      .addSelect('contribution.status', 'status')
      .addSelect('contribution.isAnonymous', 'isAnonymous')
      .addSelect('contribution.message', 'message')
      .addSelect('contribution.confirmedAt', 'confirmedAt')
      .addSelect('contribution.createdAt', 'createdAt')
      .addSelect('contributor.id', 'contributorId')
      .addSelect('contributor.name', 'contributorName')
      .addSelect('event.id', 'eventId')
      .addSelect('event.title', 'eventTitle')
      .addSelect('wishlistItem.id', 'wishlistItemId')
      .addSelect('wishlistItem.name', 'wishlistItemName')
      .orderBy('contribution.id', 'DESC')
      .limit(10)
      .getRawMany<{
        id: string;
        amount: string;
        currencyCode: string;
        status: string;
        isAnonymous: boolean | string;
        message: string | null;
        confirmedAt: Date | null;
        createdAt: Date;
        contributorId: string | null;
        contributorName: string | null;
        eventId: string | null;
        eventTitle: string | null;
        wishlistItemId: string | null;
        wishlistItemName: string | null;
      }>();

    const latestPaymentsRaw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.payer', 'payer')
      .leftJoin('payment.contribution', 'contribution')
      .leftJoin('contribution.event', 'event')
      .select('payment.id', 'id')
      .addSelect('payment.amount', 'amount')
      .addSelect('payment.currencyCode', 'currencyCode')
      .addSelect('payment.provider', 'provider')
      .addSelect('payment.paymentMethod', 'paymentMethod')
      .addSelect('payment.status', 'status')
      .addSelect('payment.providerReference', 'providerReference')
      .addSelect('payment.providerTransactionId', 'providerTransactionId')
      .addSelect('payment.confirmedAt', 'confirmedAt')
      .addSelect('payment.failedAt', 'failedAt')
      .addSelect('payment.createdAt', 'createdAt')
      .addSelect('payer.id', 'payerId')
      .addSelect('payer.name', 'payerName')
      .addSelect('event.id', 'eventId')
      .addSelect('event.title', 'eventTitle')
      .orderBy('payment.id', 'DESC')
      .limit(10)
      .getRawMany<{
        id: string;
        amount: string;
        currencyCode: string;
        provider: string;
        paymentMethod: string;
        status: string;
        providerReference: string | null;
        providerTransactionId: string | null;
        confirmedAt: Date | null;
        failedAt: Date | null;
        createdAt: Date;
        payerId: string | null;
        payerName: string | null;
        eventId: string | null;
        eventTitle: string | null;
      }>();

    return {
      summary: {
        totalUsers: Number(usersRaw?.totalUsers ?? totalUsers ?? 0),
        verifiedUsers: Number(usersRaw?.verifiedUsers ?? 0),
        unverifiedUsers: Number(usersRaw?.unverifiedUsers ?? 0),
        usersWithPhone: Number(usersRaw?.usersWithPhone ?? 0),
        usersWithoutPhone: Number(usersRaw?.usersWithoutPhone ?? 0),
        standardUsers: Number(usersRaw?.standardUsers ?? 0),
        admins: Number(usersRaw?.admins ?? 0),
        superAdmins: Number(usersRaw?.superAdmins ?? 0),
        newUsersLast7Days: Number(usersRaw?.newUsersLast7Days ?? 0),
        newUsersLast30Days: Number(usersRaw?.newUsersLast30Days ?? 0),
        totalEvents,
        totalWishlists: Number(totalWishlistsRaw?.totalWishlists ?? 0),
        totalWishlistItems: Number(
          totalWishlistItemsRaw?.totalWishlistItems ?? 0,
        ),

        totalContributions: Number(contributionsRaw?.totalContributions ?? 0),
        confirmedContributions: Number(
          contributionsRaw?.confirmedContributions ?? 0,
        ),
        awaitingPaymentContributions: Number(
          contributionsRaw?.awaitingPaymentContributions ?? 0,
        ),
        failedContributions: Number(contributionsRaw?.failedContributions ?? 0),
        confirmedContributionsAmount: Number(
          contributionsRaw?.confirmedAmount ?? 0,
        ),

        totalPayments: Number(paymentsRaw?.totalPayments ?? 0),
        initiatedPayments: Number(paymentsRaw?.initiatedPayments ?? 0),
        succeededPayments: Number(paymentsRaw?.succeededPayments ?? 0),
        failedPayments: Number(paymentsRaw?.failedPayments ?? 0),
        succeededPaymentsAmount: Number(paymentsRaw?.succeededAmount ?? 0),
        conversionRate: Number(conversionRate.toFixed(2)),
        anomaliesCount: Number(anomaliesRaw?.count ?? 0),
      },
      analytics: {
        revenueByDay,
        topEvents,
      },

      latestContributions: latestContributionsRaw.map((row) => {
        const isAnonymous =
          row.isAnonymous === true || String(row.isAnonymous) === 'true';

        return {
          id: Number(row.id),
          amount: Number(row.amount ?? 0),
          currencyCode: row.currencyCode,
          status: row.status,
          isAnonymous,
          message: row.message,
          confirmedAt: row.confirmedAt,
          createdAt: row.createdAt,
          contributor: isAnonymous
            ? null
            : row.contributorId
              ? {
                  id: Number(row.contributorId),
                  name: row.contributorName,
                }
              : null,
          event: row.eventId
            ? {
                id: Number(row.eventId),
                title: row.eventTitle,
              }
            : null,
          wishlistItem: row.wishlistItemId
            ? {
                id: Number(row.wishlistItemId),
                name: row.wishlistItemName,
              }
            : null,
        };
      }),

      latestPayments: latestPaymentsRaw.map((row) => ({
        id: Number(row.id),
        amount: Number(row.amount ?? 0),
        currencyCode: row.currencyCode,
        provider: row.provider,
        paymentMethod: row.paymentMethod,
        status: row.status,
        providerReference: row.providerReference,
        providerTransactionId: row.providerTransactionId,
        confirmedAt: row.confirmedAt,
        failedAt: row.failedAt,
        createdAt: row.createdAt,
        payer: row.payerId
          ? {
              id: Number(row.payerId),
              name: row.payerName,
            }
          : null,
        event: row.eventId
          ? {
              id: Number(row.eventId),
              title: row.eventTitle,
            }
          : null,
      })),
    };
  }
}
