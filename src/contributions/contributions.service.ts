import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Contribution } from './contribution.entity';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { ConfirmContributionDto } from './dto/confirm-contribution.dto';
import { ContributionStatus } from './enums/contribution-status.enum';
import { FundingStatus } from '../wishlist-items/enums/funding-status.enum';
import { ReservationMode } from '../wishlist-items/enums/reservation-mode.enum';
import { EventParticipant } from '../participants/event-participant.entity';
import { ParticipantRole } from '../participants/enums/participant-role.enum';
import { ParticipantStatus } from '../participants/enums/participant-status.enum';
import { Reservation } from '../reservations/reservation.entity';
import { ReservationStatus } from '../reservations/enums/reservation-status.enum';
import { Payment } from '../payments/payment.entity';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import { PaymentProvider } from '../payments/enums/payment-provider.enum';
import { PaymentMethod } from '../payments/enums/payment-method.enum';

@Injectable()
export class ContributionsService {
  constructor(
    @InjectRepository(Contribution)
    private readonly contributionsRepository: Repository<Contribution>,

    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(WishlistItem)
    private readonly wishlistItemsRepository: Repository<WishlistItem>,

    @InjectRepository(EventParticipant)
    private readonly participantsRepository: Repository<EventParticipant>,

    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,

    private readonly dataSource: DataSource,
  ) {}

  async create(
    createContributionDto: CreateContributionDto,
  ): Promise<Contribution> {
    const {
      wishlistItemId,
      contributorUserId,
      amount,
      currencyCode,
      isAnonymous,
      message,
    } = createContributionDto;

    const wishlistItem = await this.wishlistItemsRepository.findOne({
      where: { id: wishlistItemId },
      relations: ['wishlist', 'wishlist.event'],
    });

    if (!wishlistItem) {
      throw new NotFoundException('Wishlist item introuvable');
    }

    if (!wishlistItem.wishlist?.event) {
      throw new BadRequestException(
        "Impossible de déterminer l'événement de cet item",
      );
    }

    const event = wishlistItem.wishlist.event;

    const contributor = await this.usersRepository.findOne({
      where: { id: contributorUserId },
    });

    if (!contributor) {
      throw new NotFoundException('Utilisateur contributeur introuvable');
    }

    if (wishlistItem.fundingStatus === FundingStatus.FUNDED) {
      throw new BadRequestException('Cet item est déjà totalement financé');
    }

    const pendingContribution = await this.contributionsRepository
      .createQueryBuilder('contribution')
      .where('contribution.wishlist_item_id = :wishlistItemId', {
        wishlistItemId: wishlistItem.id,
      })
      .andWhere('contribution.status IN (:...statuses)', {
        statuses: [
          ContributionStatus.AWAITING_PAYMENT,
          ContributionStatus.PENDING,
        ],
      })
      .getOne();

    if (pendingContribution) {
      throw new BadRequestException(
        'Une contribution est déjà en attente de paiement sur cet item. Veuillez attendre sa finalisation ou son annulation.',
      );
    }

    if (
      wishlistItem.reservationMode === ReservationMode.EXCLUSIVE &&
      wishlistItem.isReserved
    ) {
      const activeReservation = await this.reservationsRepository.findOne({
        where: {
          wishlistItem: { id: wishlistItem.id },
          status: ReservationStatus.ACTIVE,
        },
        relations: ['reservedBy', 'wishlistItem'],
      });

      if (
        activeReservation &&
        activeReservation.reservedBy &&
        activeReservation.reservedBy.id !== contributorUserId
      ) {
        throw new BadRequestException(
          'Cet item est réservé par un autre participant et ne peut pas être financé par vous',
        );
      }
    }

    if (Number(wishlistItem.targetAmount ?? 0) <= 0) {
      throw new BadRequestException("Cet item n'a pas de montant cible valide");
    }

    if (amount <= 0) {
      throw new BadRequestException(
        'Le montant de la contribution doit être supérieur à 0',
      );
    }

    const remainingAmount = Number(wishlistItem.remainingAmount ?? 0);

    if (remainingAmount > 0 && amount > remainingAmount) {
      throw new BadRequestException('Le montant dépasse le reste à financer');
    }

    const contribution = this.contributionsRepository.create({
      event,
      wishlistItem,
      contributor,
      amount,
      currencyCode: currencyCode ?? 'XOF',
      isAnonymous: isAnonymous ?? false,
      status: ContributionStatus.AWAITING_PAYMENT,
      message: message ?? null,
    });

    const saved = await this.contributionsRepository.save(contribution);

    const fullContribution = await this.contributionsRepository.findOne({
      where: { id: saved.id },
      relations: ['event', 'wishlistItem', 'contributor'],
    });

    if (!fullContribution) {
      throw new NotFoundException(
        'Contribution créée mais introuvable ensuite',
      );
    }

    return fullContribution;
  }

  async findAccessible(userId: number): Promise<Contribution[]> {
    const managedEventIds = await this.getManagedEventIds(userId);

    const where =
      managedEventIds.length > 0
        ? [
            { contributor: { id: userId } },
            { event: { id: In(managedEventIds) } },
          ]
        : [{ contributor: { id: userId } }];

    return await this.contributionsRepository.find({
      where,
      relations: ['event', 'wishlistItem', 'contributor'],
      order: { id: 'DESC' },
    });
  }

  async findOneAccessible(id: number, userId: number): Promise<Contribution> {
    const contribution = await this.contributionsRepository.findOne({
      where: { id },
      relations: ['event', 'wishlistItem', 'contributor'],
    });

    if (!contribution) {
      throw new NotFoundException('Contribution introuvable');
    }

    if (contribution.contributor.id === userId) {
      return contribution;
    }

    const canManage = await this.canManageEvent(userId, contribution.event.id);

    if (!canManage) {
      throw new ForbiddenException(
        'Vous ne pouvez pas consulter cette contribution',
      );
    }

    return contribution;
  }

  async findAll(): Promise<Contribution[]> {
    return await this.contributionsRepository.find({
      relations: ['event', 'wishlistItem', 'contributor'],
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Contribution> {
    const contribution = await this.contributionsRepository.findOne({
      where: { id },
      relations: ['event', 'wishlistItem', 'contributor'],
    });

    if (!contribution) {
      throw new NotFoundException('Contribution introuvable');
    }

    return contribution;
  }

  async confirm(
    id: number,
    _confirmContributionDto: ConfirmContributionDto,
  ): Promise<Contribution> {
    const contribution = await this.contributionsRepository.findOne({
      where: { id },
      relations: ['event', 'wishlistItem', 'contributor'],
    });

    if (!contribution) {
      throw new NotFoundException('Contribution introuvable');
    }

    if (contribution.status === ContributionStatus.CONFIRMED) {
      throw new BadRequestException('Cette contribution est déjà confirmée');
    }

    if (
      contribution.status !== ContributionStatus.AWAITING_PAYMENT &&
      contribution.status !== ContributionStatus.PENDING
    ) {
      throw new BadRequestException(
        'Seules les contributions en attente peuvent être confirmées',
      );
    }

    const wishlistItem = await this.wishlistItemsRepository.findOne({
      where: { id: contribution.wishlistItem.id },
    });

    if (!wishlistItem) {
      throw new NotFoundException('Wishlist item introuvable');
    }

    const targetAmount = Number(wishlistItem.targetAmount ?? 0);
    const fundedAmount = Number(wishlistItem.fundedAmount ?? 0);
    const contributionAmount = Number(contribution.amount ?? 0);

    if (targetAmount <= 0) {
      throw new BadRequestException("Cet item n'a pas de montant cible valide");
    }

    if (wishlistItem.fundingStatus === FundingStatus.FUNDED) {
      throw new BadRequestException('Cet item est déjà totalement financé');
    }

    if (fundedAmount + contributionAmount > targetAmount) {
      throw new BadRequestException(
        'Cette confirmation dépasse le montant cible de l’item',
      );
    }

    contribution.status = ContributionStatus.CONFIRMED;
    contribution.confirmedAt = new Date();

    await this.contributionsRepository.save(contribution);

    await this.recalculateWishlistItemFunding(contribution.wishlistItem.id);

    const updatedContribution = await this.contributionsRepository.findOne({
      where: { id: contribution.id },
      relations: ['event', 'wishlistItem', 'contributor'],
    });

    if (!updatedContribution) {
      throw new NotFoundException(
        'Contribution confirmée mais introuvable ensuite',
      );
    }

    return updatedContribution;
  }

  async getConfirmedTotalForWishlistItem(
    wishlistItemId: number,
  ): Promise<{ wishlistItemId: number; confirmedTotal: number }> {
    const wishlistItem = await this.wishlistItemsRepository.findOne({
      where: { id: wishlistItemId },
    });

    if (!wishlistItem) {
      throw new NotFoundException('Wishlist item introuvable');
    }

    const result = await this.contributionsRepository
      .createQueryBuilder('contribution')
      .select('COALESCE(SUM(contribution.amount), 0)', 'total')
      .where('contribution.wishlistItem = :wishlistItemId', { wishlistItemId })
      .andWhere('contribution.status = :status', {
        status: ContributionStatus.CONFIRMED,
      })
      .getRawOne<{ total: string }>();

    return {
      wishlistItemId,
      confirmedTotal: Number(result?.total ?? 0),
    };
  }

  async getUserContributions(userId: number, status?: string) {
    const where: any = {
      contributor: { id: userId },
    };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const contributions = await this.contributionsRepository.find({
      where,
      relations: [
        'event',
        'wishlistItem',
        'contributor',
        'payments',
      ],
      order: { id: 'DESC' },
    });

    const items = contributions.map((c) => {
      const latestPayment =
        c.payments && c.payments.length > 0
          ? [...c.payments].sort((a, b) => b.id - a.id)[0]
          : null;

      return {
        id: c.id,
        amount: Number(c.amount),
        currencyCode: c.currencyCode,
        status: c.status,
        isAnonymous: c.isAnonymous,
        message: c.message,
        createdAt: c.createdAt,
        confirmedAt: c.confirmedAt,
        event: c.event
          ? {
              id: c.event.id,
              title: c.event.title,
              eventDate: c.event.eventDate,
            }
          : null,
        wishlistItem: c.wishlistItem
          ? {
              id: c.wishlistItem.id,
              title: c.wishlistItem.name,
              fundingStatus: c.wishlistItem.fundingStatus,
            }
          : null,
        payment: latestPayment
          ? {
              id: latestPayment.id,
              status: latestPayment.status,
              provider: latestPayment.provider,
              paymentMethod: latestPayment.paymentMethod,
              paymentUrl: latestPayment.paymentUrl,
            }
          : null,
      };
    });

    const confirmed = items.filter(
      (i) => i.status === ContributionStatus.CONFIRMED,
    );
    const awaiting = items.filter(
      (i) => i.status === ContributionStatus.AWAITING_PAYMENT,
    );
    const failed = items.filter((i) => i.status === ContributionStatus.FAILED);

    return {
      items,
      total: items.length,
      summary: {
        totalCount: items.length,
        confirmedCount: confirmed.length,
        awaitingPaymentCount: awaiting.length,
        failedCount: failed.length,
        totalConfirmedAmount: confirmed.reduce(
          (sum, i) => sum + Number(i.amount || 0),
          0,
        ),
        currencyCode: items[0]?.currencyCode ?? 'XOF',
      },
    };
  }

  async getContributionsByEvent(eventId: number, userId: number) {
    const canManage = await this.canManageEvent(userId, eventId);

    if (!canManage) {
      throw new ForbiddenException(
        'Vous ne pouvez pas consulter les contributions de cet événement',
      );
    }

    const contributions = await this.contributionsRepository.find({
      where: {
        event: { id: eventId },
      },
      relations: ['event', 'wishlistItem', 'contributor', 'payments'],
      order: { id: 'DESC' },
    });

    const items = contributions.map((c) => {
      const latestPayment =
        c.payments && c.payments.length > 0
          ? [...c.payments].sort((a, b) => b.id - a.id)[0]
          : null;

      return {
        id: c.id,
        amount: Number(c.amount),
        currencyCode: c.currencyCode,
        status: c.status,
        isAnonymous: c.isAnonymous,
        message: c.message,
        createdAt: c.createdAt,
        confirmedAt: c.confirmedAt,
        contributor: c.isAnonymous
          ? null
          : c.contributor
            ? {
                id: c.contributor.id,
                name: c.contributor.name,
                email: c.contributor.email,
              }
            : null,
        wishlistItem: c.wishlistItem
          ? {
              id: c.wishlistItem.id,
              title: c.wishlistItem.name,
              fundingStatus: c.wishlistItem.fundingStatus,
            }
          : null,
        payment: latestPayment
          ? {
              id: latestPayment.id,
              status: latestPayment.status,
              provider: latestPayment.provider,
              paymentMethod: latestPayment.paymentMethod,
              paymentUrl: latestPayment.paymentUrl,
            }
          : null,
      };
    });

    return {
      items,
      total: items.length,
    };
  }

  async checkoutContribution(
    userId: number,
    payload: {
      wishlistItemId: number;
      amount: number;
      currencyCode: string;
      message?: string;
      isAnonymous?: boolean;
    },
  ) {
    return this.dataSource.transaction(async (manager) => {
      const contributionRepository = manager.getRepository(Contribution);
      const paymentRepository = manager.getRepository(Payment);

      const existingPending = await contributionRepository.findOne({
        where: {
          contributor: { id: userId },
          wishlistItem: { id: payload.wishlistItemId },
          status: ContributionStatus.AWAITING_PAYMENT,
        },
      });

      if (existingPending) {
        throw new BadRequestException(
          'Une contribution est déjà en attente de paiement pour cet item',
        );
      }

      const contribution = await this.create({
        wishlistItemId: payload.wishlistItemId,
        contributorUserId: userId,
        amount: payload.amount,
        currencyCode: payload.currencyCode,
        message: payload.message,
        isAnonymous: payload.isAnonymous,
      });

      const payment = paymentRepository.create({
        contribution,
        payer: { id: userId } as User,
        amount: payload.amount,
        currencyCode: payload.currencyCode ?? 'XOF',
        status: PaymentStatus.INITIATED,
        provider: PaymentProvider.OTHER,
        paymentMethod: PaymentMethod.MOBILE_MONEY,
        paymentUrl: null,
        initiatedAt: new Date(),
      });

      const savedPayment = await paymentRepository.save(payment);

      return {
        contribution,
        payment: savedPayment,
      };
    });
  }

  async markContributionAsConfirmed(id: number) {
    return this.confirm(id, {});
  }

  async markContributionAsFailed(id: number) {
    const contribution = await this.contributionsRepository.findOne({
      where: { id },
      relations: ['event', 'wishlistItem', 'contributor'],
    });

    if (!contribution) {
      throw new NotFoundException('Contribution introuvable');
    }

    if (contribution.status === ContributionStatus.CONFIRMED) {
      throw new BadRequestException(
        'Une contribution confirmée ne peut pas être marquée comme échouée',
      );
    }

    contribution.status = ContributionStatus.FAILED;
    await this.contributionsRepository.save(contribution);

    return contribution;
  }

  private async canManageEvent(
    userId: number,
    eventId: number,
  ): Promise<boolean> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });

    if (!event) {
      return false;
    }

    if (event.organizer?.id === userId) {
      return true;
    }

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

  private async getManagedEventIds(userId: number): Promise<number[]> {
    const organizedEvents = await this.eventsRepository.find({
      where: {
        organizer: { id: userId },
      },
      select: { id: true },
      relations: ['organizer'],
    });

    const organizedIds = organizedEvents.map((event) => event.id);

    const participantRows = await this.participantsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: ['event', 'user'],
    });

    const coManagedIds = participantRows
      .filter(
        (participant) =>
          participant.status === ParticipantStatus.ACCEPTED &&
          (participant.role === ParticipantRole.ORGANIZER ||
            participant.role === ParticipantRole.CO_ORGANIZER),
      )
      .map((participant) => participant.event.id);

    return Array.from(new Set([...organizedIds, ...coManagedIds]));
  }

  private async recalculateWishlistItemFunding(
    wishlistItemId: number,
  ): Promise<void> {
    const wishlistItem = await this.wishlistItemsRepository.findOne({
      where: { id: wishlistItemId },
    });

    if (!wishlistItem) {
      throw new NotFoundException('Wishlist item introuvable');
    }

    const result = await this.contributionsRepository
      .createQueryBuilder('contribution')
      .select('COALESCE(SUM(contribution.amount), 0)', 'total')
      .where('contribution.wishlistItem = :wishlistItemId', { wishlistItemId })
      .andWhere('contribution.status = :status', {
        status: ContributionStatus.CONFIRMED,
      })
      .getRawOne<{ total: string }>();

    const confirmedTotal = Number(result?.total ?? 0);
    const targetAmount = Number(wishlistItem.targetAmount ?? 0);
    const remainingAmount = Math.max(targetAmount - confirmedTotal, 0);

    wishlistItem.fundedAmount = confirmedTotal;
    wishlistItem.remainingAmount = remainingAmount;

    if (confirmedTotal <= 0) {
      wishlistItem.fundingStatus = FundingStatus.NOT_FUNDED;
    } else if (confirmedTotal >= targetAmount && targetAmount > 0) {
      wishlistItem.fundingStatus = FundingStatus.FUNDED;
    } else {
      wishlistItem.fundingStatus = FundingStatus.PARTIALLY_FUNDED;
    }

    await this.wishlistItemsRepository.save(wishlistItem);
  }
}
