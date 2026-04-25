import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';

import { Payment } from '../payments/payment.entity';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import { Event } from './event.entity';
import { User } from '../users/user.entity';
import { EventParticipant } from '../participants/event-participant.entity';
import { ParticipantRole } from '../participants/enums/participant-role.enum';
import { ParticipantStatus } from '../participants/enums/participant-status.enum';
import { Wishlist } from '../wishlists/wishlist.entity';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { Reservation } from '../reservations/reservation.entity';
import { ReservationStatus } from '../reservations/enums/reservation-status.enum';
import { Contribution } from '../contributions/contribution.entity';
import { ContributionStatus } from '../contributions/enums/contribution-status.enum';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(EventParticipant)
    private readonly participantsRepository: Repository<EventParticipant>,

    @InjectRepository(Wishlist)
    private readonly wishlistsRepository: Repository<Wishlist>,

    @InjectRepository(WishlistItem)
    private readonly wishlistItemsRepository: Repository<WishlistItem>,

    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,

    @InjectRepository(Contribution)
    private readonly contributionsRepository: Repository<Contribution>,

    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
  ) {}

  getAllEvents() {
    return this.eventsRepository.find({
      relations: ['organizer'],
      order: { id: 'DESC' },
    });
  }

  private async generateUniqueShareToken(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const token = randomBytes(24).toString('hex');

      const existing = await this.eventsRepository.findOne({
        where: { shareToken: token },
        select: ['id'],
      });

      if (!existing) {
        return token;
      }
    }

    throw new Error('Impossible de générer un shareToken unique');
  }

  async createEvent(
    title: string,
    eventDate: Date,
    userId: number,
    description?: string,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (!user.phoneNumber || user.phoneNumber.trim().length === 0) {
      throw new ForbiddenException(
        'Veuillez ajouter un numéro de téléphone à votre profil avant de créer un événement',
      );
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Veuillez vérifier votre adresse email avant de créer un événement',
      );
    }

    const shareToken = await this.generateUniqueShareToken();

    const savedEvent = await this.eventsRepository.save(
      this.eventsRepository.create({
        title,
        eventDate,
        description,
        organizer: user,
        shareToken,
      }),
    );

    await this.participantsRepository.save(
      this.participantsRepository.create({
        event: savedEvent,
        user,
        role: ParticipantRole.ORGANIZER,
        status: ParticipantStatus.ACCEPTED,
        joinedAt: new Date(),
      }),
    );

    const wishlistToCreate = this.wishlistsRepository.create({
      title: `Wishlist - ${savedEvent.title}`,
      description: description ?? null,
      event: savedEvent,
    });

    const savedWishlist = await this.wishlistsRepository.save(wishlistToCreate);

    return {
      eventId: savedEvent.id,
      shareToken,
      wishlistId: savedWishlist.id,
    };
  }

  async getInviteLink(eventId: number, userId: number) {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    const canManage = await this.canManageEvent(userId, eventId);

    if (!canManage) {
      throw new ForbiddenException(
        'Vous ne pouvez pas générer un lien d’invitation',
      );
    }

    if (!event.shareToken) {
      event.shareToken = await this.generateUniqueShareToken();
      await this.eventsRepository.save(event);
    }

    return {
      eventId: event.id,
      shareToken: event.shareToken,
      invitePath: `/join/${event.shareToken}`,
    };
  }

  async getEventPreviewByShareToken(shareToken: string) {
    const event = await this.eventsRepository.findOne({
      where: { shareToken },
      relations: ['organizer'],
    });

    if (!event) {
      throw new NotFoundException('Lien d’invitation invalide');
    }

    return {
      id: event.id,
      title: event.title,
      eventDate: event.eventDate,
      description: event.description,
      organizer: event.organizer
        ? {
            id: event.organizer.id,
            name: event.organizer.name,
            email: event.organizer.email,
          }
        : null,
    };
  }

  async getMyEventView(eventId: number, userId: number) {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    const participant = await this.participantsRepository.findOne({
      where: {
        event: { id: eventId },
        user: { id: userId },
      },
    });

    let accessRole: ParticipantRole | null = null;

    if (participant && participant.status === ParticipantStatus.ACCEPTED) {
      accessRole = participant.role;
    } else if (event.organizer?.id === userId) {
      accessRole = ParticipantRole.ORGANIZER;
    }

    if (!accessRole) {
      throw new ForbiddenException('Accès refusé à cet événement');
    }

    const participantsCount = await this.participantsRepository.count({
      where: {
        event: { id: eventId },
        status: ParticipantStatus.ACCEPTED,
      },
    });

    const wishlist = await this.wishlistsRepository.findOne({
      where: { event: { id: eventId } },
    });

    const wishlistItems = await this.wishlistItemsRepository.find({
      where: { eventId },
      order: { id: 'DESC' },
    });

    const wishlistItemIds = wishlistItems.map((item) => item.id);

    const contributions =
      wishlistItemIds.length > 0
        ? await this.contributionsRepository.find({
            where: wishlistItemIds.map((id) => ({
              wishlistItem: { id },
            })),
            relations: ['contributor', 'wishlistItem'],
          })
        : [];

    const contributionsByItem = new Map<number, Contribution[]>();

    for (const contribution of contributions) {
      const wishlistItemId = contribution.wishlistItem?.id;

      if (!wishlistItemId) {
        continue;
      }

      const list = contributionsByItem.get(wishlistItemId) ?? [];
      list.push(contribution);
      contributionsByItem.set(wishlistItemId, list);
    }

    const pendingContributionIds = contributions
      .filter((contribution) =>
        [
          ContributionStatus.AWAITING_PAYMENT,
          ContributionStatus.PENDING,
        ].includes(contribution.status),
      )
      .map((contribution) => contribution.id);

    const pendingPayments =
      pendingContributionIds.length > 0
        ? await this.paymentsRepository.find({
            where: pendingContributionIds.map((id) => ({
              contribution: { id },
              status: PaymentStatus.INITIATED,
            })),
            relations: ['contribution'],
            order: { id: 'DESC' },
          })
        : [];

    const paymentByContributionId = new Map<number, Payment>();

    for (const payment of pendingPayments) {
      const contributionId = payment.contribution?.id;

      if (!contributionId) {
        continue;
      }

      if (!paymentByContributionId.has(contributionId)) {
        paymentByContributionId.set(contributionId, payment);
      }
    }

    const activeReservations =
      wishlistItemIds.length > 0
        ? await this.reservationsRepository.find({
            where: wishlistItemIds.map((id) => ({
              wishlistItem: { id },
              status: ReservationStatus.ACTIVE,
            })),
            relations: ['wishlistItem', 'reservedBy'],
          })
        : [];

    const reservationMap = new Map<number, Reservation>();

    for (const reservation of activeReservations) {
      if (reservation.wishlistItem?.id) {
        reservationMap.set(reservation.wishlistItem.id, reservation);
      }
    }

    const totalTargetAmount = wishlistItems.reduce(
      (sum, item) => sum + Number(item.targetAmount ?? 0),
      0,
    );

    const totalFundedAmount = wishlistItems.reduce(
      (sum, item) => sum + Number(item.fundedAmount ?? 0),
      0,
    );

    const totalRemainingAmount = wishlistItems.reduce(
      (sum, item) => sum + Number(item.remainingAmount ?? 0),
      0,
    );

    const confirmedContribution = await this.contributionsRepository.findOne({
      where: {
        event: { id: eventId },
        status: ContributionStatus.CONFIRMED,
      },
    });

    const successfulPayment = await this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.contribution', 'contribution')
      .leftJoin('contribution.event', 'event')
      .where('event.id = :eventId', { eventId })
      .andWhere('payment.status = :status', {
        status: PaymentStatus.SUCCEEDED,
      })
      .getOne();

    let canDelete = true;
    let deleteBlockedReason: string | null = null;

    if (confirmedContribution || successfulPayment) {
      canDelete = false;
      deleteBlockedReason =
        'Suppression impossible : des contributions validées ou des paiements effectués existent déjà.';
    }

    return {
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        eventDate: event.eventDate,
        organizer: event.organizer
          ? {
              id: event.organizer.id,
              name: event.organizer.name,
              email: event.organizer.email,
            }
          : null,
        wishlistId: wishlist?.id ?? null,
        canDelete,
        deleteBlockedReason,
        isArchived: event.isArchived,
        archivedAt: event.archivedAt,
      },
      accessRole,
      summary: {
        participantsCount,
        totalItems: wishlistItems.length,
        totalTargetAmount,
        totalFundedAmount,
        totalRemainingAmount,
      },
      wishlist: wishlistItems.map((item) => {
        const reservation = reservationMap.get(item.id);
        const reservedByMe = reservation?.reservedBy?.id === userId;

        const itemContributions = contributionsByItem.get(item.id) ?? [];

        const hasPendingContribution = itemContributions.some((contribution) =>
          [
            ContributionStatus.AWAITING_PAYMENT,
            ContributionStatus.PENDING,
          ].includes(contribution.status),
        );

        const hasConfirmedContribution = itemContributions.some(
          (contribution) =>
            contribution.status === ContributionStatus.CONFIRMED,
        );

        const myPendingContribution =
          itemContributions.find(
            (contribution) =>
              contribution.contributor?.id === userId &&
              [
                ContributionStatus.AWAITING_PAYMENT,
                ContributionStatus.PENDING,
              ].includes(contribution.status),
          ) ?? null;

        const myPendingPayment = myPendingContribution
          ? (paymentByContributionId.get(myPendingContribution.id) ?? null)
          : null;

        const canReserve =
          !item.isReserved &&
          !hasConfirmedContribution &&
          !hasPendingContribution;

        const canContribute =
          Number(item.remainingAmount ?? 0) > 0 &&
          (!item.isReserved || reservedByMe) &&
          !hasPendingContribution;

        return {
          id: item.id,
          name: item.name,
          imageUrl: item.imageUrl ?? null,
          quantity: Number(item.quantity ?? 1),
          targetAmount: Number(item.targetAmount ?? 0),
          fundedAmount: Number(item.fundedAmount ?? 0),
          remainingAmount: Number(item.remainingAmount ?? 0),
          fundingStatus: item.fundingStatus,
          reservationMode: item.reservationMode,
          isReserved: item.isReserved,
          reservedByUserId: reservation?.reservedBy?.id ?? null,
          reservedByMe,
          reservedByName: reservation?.reservedBy?.name ?? null,
          canReserve,
          canContribute,
          hasPendingContribution,
          pendingContributionByMe: !!myPendingContribution,
          pendingPaymentId: myPendingPayment?.id ?? null,
        };
      }),
    };
  }

  private async canManageEvent(
    userId: number,
    eventId: number,
  ): Promise<boolean> {
    const participant = await this.participantsRepository.findOne({
      where: {
        event: { id: eventId },
        user: { id: userId },
      },
    });

    if (!participant) {
      return false;
    }

    return (
      participant.status === ParticipantStatus.ACCEPTED &&
      (participant.role === ParticipantRole.ORGANIZER ||
        participant.role === ParticipantRole.CO_ORGANIZER)
    );
  }

  async deleteEvent(eventId: number, userId: number): Promise<void> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    const participant = await this.participantsRepository.findOne({
      where: {
        event: { id: eventId },
        user: { id: userId },
      },
    });

    const isOrganizer =
      participant?.status === ParticipantStatus.ACCEPTED &&
      participant.role === ParticipantRole.ORGANIZER;

    if (!isOrganizer) {
      throw new ForbiddenException(
        'Seul l’organisateur principal peut supprimer cet événement',
      );
    }

    const successfulPayment = await this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.contribution', 'contribution')
      .leftJoin('contribution.event', 'event')
      .where('event.id = :eventId', { eventId })
      .andWhere('payment.status = :status', {
        status: PaymentStatus.SUCCEEDED,
      })
      .getOne();

    if (successfulPayment) {
      throw new ForbiddenException(
        'Impossible de supprimer cet événement : un paiement a déjà été effectué',
      );
    }

    await this.eventsRepository.remove(event);
  }

  async archiveEvent(eventId: number, userId: number): Promise<void> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Événement introuvable');
    if (event.organizer?.id !== userId)
      throw new ForbiddenException('Accès refusé');
    if (event.isArchived)
      throw new BadRequestException('Événement déjà archivé');

    event.isArchived = true;
    event.archivedAt = new Date();
    await this.eventsRepository.save(event);
  }

  async unarchiveEvent(eventId: number, userId: number): Promise<void> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Événement introuvable');
    if (event.organizer?.id !== userId)
      throw new ForbiddenException('Accès refusé');
    if (!event.isArchived)
      throw new BadRequestException('Événement non archivé');

    event.isArchived = false;
    event.archivedAt = null;
    await this.eventsRepository.save(event);
  }
}
