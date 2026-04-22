import {
  Injectable,
  NotFoundException,
  ConflictException,
  Delete,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { WishlistItem } from './wishlist-item.entity';
import { Wishlist } from '../wishlists/wishlist.entity';
import { FundingStatus } from './enums/funding-status.enum';
import { ReservationMode } from './enums/reservation-mode.enum';
import { Contribution } from '../contributions/contribution.entity';
import { ForbiddenException } from '@nestjs/common';
import { Reservation } from '../reservations/reservation.entity';
import { ReservationStatus } from '../reservations/enums/reservation-status.enum';
import { ContributionStatus } from '../contributions/enums/contribution-status.enum';
import { Payment } from '../payments/payment.entity';
import { PaymentStatus } from '../payments/enums/payment-status.enum';

export type EventWishlistFilter = 'all' | 'available' | 'reserved' | 'funded';
export type EventWishlistSort =
  | 'created_desc'
  | 'created_asc'
  | 'progress_desc'
  | 'remaining_asc'
  | 'name_asc';

@Injectable()
export class WishlistItemsService {
  constructor(
    @InjectRepository(WishlistItem)
    private readonly wishlistItemsRepository: Repository<WishlistItem>,

    @InjectRepository(Wishlist)
    private readonly wishlistsRepository: Repository<Wishlist>,
  ) {}

  getAllWishlistItems() {
    return this.wishlistItemsRepository.find();
  }

  async createWishlistItem(
    name: string,
    wishlistId: number,
    price?: number,
    quantity?: number,
    imageUrl?: string,
  ) {
    const wishlist = await this.wishlistsRepository.findOne({
      where: { id: wishlistId },
      relations: ['event'],
    });

    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    const trimmedName = name.trim();
    const normalizedName = trimmedName.toLowerCase();

    const existingItem = await this.wishlistItemsRepository
      .createQueryBuilder('item')
      .leftJoin('item.wishlist', 'wishlist')
      .where('wishlist.id = :wishlistId', { wishlistId })
      .andWhere('LOWER(TRIM(item.name)) = :normalizedName', { normalizedName })
      .getOne();

    if (existingItem) {
      throw new ConflictException(
        'Un item avec ce nom existe déjà dans cette wishlist',
      );
    }

    const safeQuantity = quantity ?? 1;
    const safePrice = price ?? 0;
    const targetAmount = Number(safePrice) * Number(safeQuantity);

    const item = this.wishlistItemsRepository.create({
      name: trimmedName,
      price: safePrice,
      quantity: safeQuantity,
      imageUrl: imageUrl?.trim() ? imageUrl.trim() : null,
      wishlist,
      eventId: wishlist.event.id,
      targetAmount,
      fundedAmount: 0,
      remainingAmount: targetAmount,
      fundingStatus: FundingStatus.NOT_FUNDED,
      reservationMode: ReservationMode.EXCLUSIVE,
    });

    return this.wishlistItemsRepository.save(item);
  }

  async getEventWishlist(
    eventId: number,
    filter: EventWishlistFilter = 'all',
    sort: EventWishlistSort = 'created_desc',
  ) {
    const qb = this.wishlistItemsRepository
      .createQueryBuilder('item')
      .leftJoin(
        Contribution,
        'contribution',
        'contribution.wishlist_item_id = item.id AND contribution.status = :confirmedStatus',
        {
          confirmedStatus: ContributionStatus.CONFIRMED,
        },
      )
      .select('item.id', 'id')
      .addSelect('item.name', 'name')
      .addSelect('item.price', 'price')
      .addSelect('item.quantity', 'quantity')
      .addSelect('item.imageUrl', 'imageUrl')
      .addSelect('item.isReserved', 'isReserved')
      .addSelect('item.reservationMode', 'reservationMode')
      .addSelect('item.targetAmount', 'targetAmount')
      .addSelect('item.fundedAmount', 'fundedAmount')
      .addSelect('item.remainingAmount', 'remainingAmount')
      .addSelect('item.fundingStatus', 'fundingStatus')
      .addSelect(
        `
      CASE
        WHEN item.targetAmount IS NULL OR item.targetAmount = 0 THEN 0
        ELSE ROUND((item.fundedAmount / item.targetAmount) * 100, 2)
      END
      `,
        'progressPercent',
      )
      .addSelect('COUNT(contribution.id)', 'confirmedContributionsCount')
      .addSelect(
        'COUNT(DISTINCT contribution.contributor_user_id)',
        'contributorsCount',
      )
      .where('item.eventId = :eventId', { eventId })
      .groupBy('item.id');

    this.applyFilter(qb, filter);
    this.applySort(qb, sort);

    const rows = await qb.getRawMany();

    const items = rows.map((item) => ({
      id: Number(item.id),
      name: item.name,
      price: item.price !== null ? Number(item.price) : null,
      quantity: Number(item.quantity ?? 0),
      imageUrl: item.imageUrl ?? null,
      isReserved:
        item.isReserved === true || String(item.isReserved) === 'true',
      reservationMode: item.reservationMode as ReservationMode,
      targetAmount: Number(item.targetAmount ?? 0),
      fundedAmount: Number(item.fundedAmount ?? 0),
      remainingAmount: Number(item.remainingAmount ?? 0),
      fundingStatus: item.fundingStatus as FundingStatus,
      progressPercent: Number(item.progressPercent ?? 0),
      confirmedContributionsCount: Number(
        item.confirmedContributionsCount ?? 0,
      ),
      contributorsCount: Number(item.contributorsCount ?? 0),
    }));

    return items;
  }

  async getWishlistItemDetails(id: number) {
    const item = await this.wishlistItemsRepository.findOne({
      where: { id },
      relations: ['wishlist', 'wishlist.event'],
    });

    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }

    const contributionsRaw = await this.wishlistItemsRepository.manager
      .createQueryBuilder(Contribution, 'contribution')
      .leftJoin('contribution.contributor', 'contributor')
      .select('contribution.id', 'id')
      .addSelect('contribution.amount', 'amount')
      .addSelect('contribution.currencyCode', 'currencyCode')
      .addSelect('contribution.isAnonymous', 'isAnonymous')
      .addSelect('contribution.message', 'message')
      .addSelect('contribution.confirmedAt', 'confirmedAt')
      .addSelect('contributor.id', 'contributorId')
      .addSelect('contributor.name', 'contributorName')
      .where('contribution.wishlist_item_id = :wishlistItemId', {
        wishlistItemId: id,
      })
      .andWhere('contribution.status = :status', {
        status: ContributionStatus.CONFIRMED,
      })
      .orderBy('contribution.confirmedAt', 'DESC')
      .getRawMany<{
        id: string;
        amount: string;
        currencyCode: string;
        isAnonymous: boolean | string;
        message: string | null;
        confirmedAt: Date | null;
        contributorId: string | null;
        contributorName: string | null;
      }>();

    const targetAmount = Number(item.targetAmount ?? 0);
    const fundedAmount = Number(item.fundedAmount ?? 0);
    const remainingAmount = Number(item.remainingAmount ?? 0);
    const progressPercent =
      targetAmount > 0
        ? Number(((fundedAmount / targetAmount) * 100).toFixed(2))
        : 0;

    const contributions = contributionsRaw.map((contribution) => {
      const isAnonymous =
        contribution.isAnonymous === true ||
        String(contribution.isAnonymous) === 'true';

      return {
        id: Number(contribution.id),
        amount: Number(contribution.amount ?? 0),
        currencyCode: contribution.currencyCode,
        isAnonymous,
        message: contribution.message,
        confirmedAt: contribution.confirmedAt,
        contributor: isAnonymous
          ? null
          : contribution.contributorId
            ? {
                id: Number(contribution.contributorId),
                name: contribution.contributorName,
              }
            : null,
      };
    });

    const uniqueContributors = new Set(
      contributions
        .filter((c) => c.contributor !== null)
        .map((c) => c.contributor!.id),
    );

    return {
      item: {
        id: item.id,
        eventId: item.eventId,
        eventTitle: item.wishlist?.event?.title ?? null,
        wishlistId: item.wishlist?.id ?? null,
        name: item.name,
        price: item.price !== null ? Number(item.price) : null,
        quantity: Number(item.quantity ?? 0),
        imageUrl: item.imageUrl ?? null,
        isReserved: item.isReserved,
        reservationMode: item.reservationMode,
        targetAmount,
        fundedAmount,
        remainingAmount,
        fundingStatus: item.fundingStatus,
        progressPercent,
      },
      stats: {
        confirmedContributionsCount: contributions.length,
        contributorsCount: uniqueContributors.size,
      },
      contributions,
    };
  }

  private applyFilter(
    qb: SelectQueryBuilder<WishlistItem>,
    filter: EventWishlistFilter,
  ) {
    switch (filter) {
      case 'available':
        qb.andWhere('item.isReserved = :isReserved', {
          isReserved: false,
        }).andWhere('item.fundingStatus != :fundedStatus', {
          fundedStatus: FundingStatus.FUNDED,
        });
        break;

      case 'reserved':
        qb.andWhere('item.isReserved = :isReserved', { isReserved: true });
        break;

      case 'funded':
        qb.andWhere('item.fundingStatus = :fundedStatus', {
          fundedStatus: FundingStatus.FUNDED,
        });
        break;

      case 'all':
      default:
        break;
    }
  }

  private applySort(
    qb: SelectQueryBuilder<WishlistItem>,
    sort: EventWishlistSort,
  ) {
    switch (sort) {
      case 'created_asc':
        qb.orderBy('item.id', 'ASC');
        break;

      case 'progress_desc':
        qb.orderBy(
          'item.fundedAmount / NULLIF(item.targetAmount, 0)',
          'DESC',
          'NULLS LAST',
        ).addOrderBy('item.id', 'ASC');
        break;

      case 'remaining_asc':
        qb.orderBy('item.remainingAmount', 'ASC').addOrderBy('item.id', 'ASC');
        break;

      case 'name_asc':
        qb.orderBy('item.name', 'ASC');
        break;

      case 'created_desc':
      default:
        qb.orderBy('item.id', 'DESC');
        break;
    }
  }

  async deleteWishlistItem(id: number) {
    const item = await this.wishlistItemsRepository.findOne({
      where: { id },
      relations: ['reservations', 'contributions', 'contributions.payments'],
    });

    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }

    // ❌ 1. item réservé
    const hasActiveReservation = item.reservations?.some(
      (r) => r.status === ReservationStatus.ACTIVE,
    );

    if (hasActiveReservation) {
      throw new ForbiddenException(
        "Impossible de supprimer : l'item est réservé",
      );
    }

    // ❌ 2. contribution en cours (AWAITING_PAYMENT)
    const hasPendingContribution = item.contributions?.some(
      (c) => c.status === ContributionStatus.AWAITING_PAYMENT,
    );

    if (hasPendingContribution) {
      throw new ForbiddenException(
        'Impossible de supprimer : contribution en cours',
      );
    }

    // ❌ 3. paiement validé (SUCCEEDED)
    const hasSucceededPayment = item.contributions?.some((c) =>
      c.payments?.some((p) => p.status === PaymentStatus.SUCCEEDED),
    );

    if (hasSucceededPayment) {
      throw new ForbiddenException(
        'Impossible de supprimer : paiement déjà validé',
      );
    }

    await this.wishlistItemsRepository.remove(item);

    return { success: true };
  }
}
