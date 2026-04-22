import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParticipantRole } from '../participants/enums/participant-role.enum';

import { Event } from './event.entity';
import { EventParticipant } from '../participants/event-participant.entity';
import { Wishlist } from '../wishlists/wishlist.entity';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { Contribution } from '../contributions/contribution.entity';
import { Payment } from '../payments/payment.entity';

import { ParticipantStatus } from '../participants/enums/participant-status.enum';
import { FundingStatus } from '../wishlist-items/enums/funding-status.enum';
import { ContributionStatus } from '../contributions/enums/contribution-status.enum';
import { PaymentStatus } from '../payments/enums/payment-status.enum';

@Injectable()
export class EventDashboardService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,

    @InjectRepository(EventParticipant)
    private readonly participantsRepository: Repository<EventParticipant>,

    @InjectRepository(Wishlist)
    private readonly wishlistsRepository: Repository<Wishlist>,

    @InjectRepository(WishlistItem)
    private readonly wishlistItemsRepository: Repository<WishlistItem>,

    @InjectRepository(Contribution)
    private readonly contributionsRepository: Repository<Contribution>,

    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
  ) {}

  async getEventDashboard(eventId: number) {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    const wishlist = await this.wishlistsRepository.findOne({
      where: { event: { id: eventId } },
      relations: ['event'],
    });

    const participantsCount = await this.participantsRepository.count({
      where: {
        event: { id: eventId },
        status: ParticipantStatus.ACCEPTED,
      },
    });

    const itemsRaw = await this.wishlistItemsRepository
      .createQueryBuilder('item')
      .select('COUNT(item.id)', 'totalItems')
      .addSelect(
        `SUM(CASE WHEN item.isReserved = true THEN 1 ELSE 0 END)`,
        'reservedItems',
      )
      .addSelect(
        `SUM(CASE WHEN item.fundingStatus = :fundedStatus THEN 1 ELSE 0 END)`,
        'fundedItems',
      )
      .addSelect(
        `SUM(CASE WHEN item.fundingStatus = :partiallyFundedStatus THEN 1 ELSE 0 END)`,
        'partiallyFundedItems',
      )
      .addSelect(
        `SUM(CASE WHEN item.fundingStatus = :notFundedStatus THEN 1 ELSE 0 END)`,
        'notFundedItems',
      )
      .addSelect('COALESCE(SUM(item.targetAmount), 0)', 'totalTargetAmount')
      .addSelect('COALESCE(SUM(item.fundedAmount), 0)', 'totalFundedAmount')
      .addSelect(
        'COALESCE(SUM(item.remainingAmount), 0)',
        'totalRemainingAmount',
      )
      .where('item.eventId = :eventId', { eventId })
      .setParameters({
        fundedStatus: FundingStatus.FUNDED,
        partiallyFundedStatus: FundingStatus.PARTIALLY_FUNDED,
        notFundedStatus: FundingStatus.NOT_FUNDED,
      })
      .getRawOne<{
        totalItems: string;
        reservedItems: string;
        fundedItems: string;
        partiallyFundedItems: string;
        notFundedItems: string;
        totalTargetAmount: string;
        totalFundedAmount: string;
        totalRemainingAmount: string;
      }>();

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
      .where('contribution.event_id = :eventId', { eventId })
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
      .innerJoin('payment.contribution', 'contribution')
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
      .where('contribution.event_id = :eventId', { eventId })
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
      .leftJoin('contribution.contributor', 'contributor')
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
      .where('contribution.event_id = :eventId', { eventId })
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
        contributorId: string | null;
        contributorName: string | null;
      }>();

    const latestPaymentsRaw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.contribution', 'contribution')
      .leftJoin('payment.payer', 'payer')
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
      .where('contribution.event_id = :eventId', { eventId })
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
        payerId: string | null;
        payerName: string | null;
      }>();

    const totalItems = Number(itemsRaw?.totalItems ?? 0);
    const fundedItems = Number(itemsRaw?.fundedItems ?? 0);
    const totalTargetAmount = Number(itemsRaw?.totalTargetAmount ?? 0);
    const totalFundedAmount = Number(itemsRaw?.totalFundedAmount ?? 0);

    const fundingProgressPercent =
      totalTargetAmount > 0
        ? Number(((totalFundedAmount / totalTargetAmount) * 100).toFixed(2))
        : 0;

    return {
      event: {
        id: event.id,
        title: event.title,
        eventDate: event.eventDate,
        description: event.description ?? null,
        organizer: event.organizer
          ? {
              id: event.organizer.id,
              name: event.organizer.name,
              email: event.organizer.email,
            }
          : null,
      },

      wishlist: wishlist
        ? {
            id: wishlist.id,
            title: wishlist.title,
            description: wishlist.description ?? null,
          }
        : null,

      summary: {
        participantsCount,
        totalItems,
        reservedItems: Number(itemsRaw?.reservedItems ?? 0),
        fundedItems,
        partiallyFundedItems: Number(itemsRaw?.partiallyFundedItems ?? 0),
        notFundedItems: Number(itemsRaw?.notFundedItems ?? 0),

        totalTargetAmount,
        totalFundedAmount,
        totalRemainingAmount: Number(itemsRaw?.totalRemainingAmount ?? 0),
        fundingProgressPercent,

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
      })),
    };
  }

  async getEventDashboardSecured(eventId: number, userId: number) {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    // ✅ ORGANIZER
    if (event.organizer?.id === userId) {
      return this.getEventDashboard(eventId);
    }

    // ✅ CO-ORGANIZER
    const participant = await this.participantsRepository.findOne({
      where: {
        event: { id: eventId },
        user: { id: userId },
      },
    });

    if (
      participant &&
      participant.status === ParticipantStatus.ACCEPTED &&
      (participant.role === ParticipantRole.ORGANIZER ||
        participant.role === ParticipantRole.CO_ORGANIZER)
    ) {
      return this.getEventDashboard(eventId);
    }

    throw new ForbiddenException(
      "Vous n'avez pas accès au dashboard de cet événement",
    );
  }
}
