import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Reservation } from './reservation.entity';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';

import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReleaseReservationDto } from './dto/release-reservation.dto';

import { ReservationStatus } from './enums/reservation-status.enum';
import { ReservationMode } from '../wishlist-items/enums/reservation-mode.enum';
import { Contribution } from '../contributions/contribution.entity';
import { ContributionStatus } from '../contributions/enums/contribution-status.enum';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,

    @InjectRepository(WishlistItem)
    private readonly wishlistItemsRepository: Repository<WishlistItem>,

    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    private readonly auditService: AuditService,

    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateReservationDto): Promise<Reservation> {
    const { wishlistItemId, eventId, reservedByUserId } = dto;

    return this.reservationsRepository.manager.transaction(async (manager) => {
      const itemRepo = manager.getRepository(WishlistItem);
      const reservationRepo = manager.getRepository(Reservation);

      const item = await itemRepo.findOne({
        where: { id: wishlistItemId },
        relations: ['wishlist', 'wishlist.event'],
      });

      if (!item) throw new NotFoundException('Item introuvable');

      if (item.wishlist.event.id !== eventId) {
        throw new BadRequestException('Item invalide pour cet événement');
      }

      if (item.reservationMode === ReservationMode.NONE) {
        throw new BadRequestException('Item non réservable');
      }

      const confirmedContribution = await manager
        .getRepository(Contribution)
        .createQueryBuilder('contribution')
        .where('contribution.wishlist_item_id = :wishlistItemId', {
          wishlistItemId: item.id,
        })
        .andWhere('contribution.status = :status', {
          status: ContributionStatus.CONFIRMED,
        })
        .getOne();

      if (confirmedContribution) {
        throw new BadRequestException(
          'Impossible de réserver : cet item a déjà une contribution confirmée',
        );
      }

      const activeReservations = await reservationRepo.find({
        where: {
          wishlistItem: { id: item.id },
          status: ReservationStatus.ACTIVE,
        },
        relations: ['reservedBy'],
      });

      if (item.reservationMode === ReservationMode.EXCLUSIVE) {
        if (activeReservations.length > 0) {
          const existing = activeReservations[0];

          if (existing.reservedBy.id === reservedByUserId) {
            throw new ConflictException('Déjà réservé par vous');
          }

          throw new ConflictException('Déjà réservé');
        }
      }

      const reservedAt = new Date();
      const expiresAt = new Date(reservedAt.getTime() + 24 * 60 * 60 * 1000);

      const reservation = reservationRepo.create({
        wishlistItem: item,
        event: item.wishlist.event,
        reservedBy: { id: reservedByUserId } as any,
        status: ReservationStatus.ACTIVE,
        reservedAt,
        expiresAt,
      });

      const saved = await reservationRepo.save(reservation);

      item.isReserved = true;
      await itemRepo.save(item);

      return saved;
    });
  }

  async findAllByUser(userId: number) {
    const items = await this.reservationsRepository.find({
      where: { reservedBy: { id: userId } },
      relations: ['wishlistItem', 'event'],
      order: { id: 'DESC' },
    });

    return {
      items,
      total: items.length,
    };
  }

  async findOneForUser(id: number, userId: number) {
    const reservation = await this.reservationsRepository.findOne({
      where: { id },
      relations: ['wishlistItem', 'event', 'reservedBy'],
    });

    if (!reservation) {
      throw new NotFoundException();
    }

    if (reservation.reservedBy.id !== userId) {
      throw new ForbiddenException('Accès interdit');
    }

    return reservation;
  }

  async releaseForUser(
    id: number,
    userId: number,
    dto: ReleaseReservationDto,
  ): Promise<Reservation> {
    return this.reservationsRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Reservation);
      const itemRepo = manager.getRepository(WishlistItem);

      const reservation = await repo.findOne({
        where: { id },
        relations: ['wishlistItem', 'reservedBy'],
      });

      if (!reservation) {
        throw new NotFoundException();
      }

      if (reservation.reservedBy.id !== userId) {
        throw new ForbiddenException('Vous ne pouvez pas libérer ceci');
      }

      if (reservation.status !== ReservationStatus.ACTIVE) {
        throw new BadRequestException('Déjà libéré');
      }

      reservation.status = ReservationStatus.RELEASED;
      reservation.releasedAt = new Date();
      reservation.releaseReason = dto.reason ?? null;

      await repo.save(reservation);

      const remaining = await repo.count({
        where: {
          wishlistItem: { id: reservation.wishlistItem.id },
          status: ReservationStatus.ACTIVE,
        },
      });

      if (remaining === 0) {
        reservation.wishlistItem.isReserved = false;
        await itemRepo.save(reservation.wishlistItem);
      }

      return reservation;
    });
  }

  async cleanupExpiredReservations() {
    const now = new Date();

    const expiredReservations = await this.reservationsRepository
      .createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.wishlistItem', 'item')
      .leftJoinAndSelect('reservation.reservedBy', 'user')
      .where('reservation.status = :status', {
        status: ReservationStatus.ACTIVE,
      })
      .andWhere('reservation.expiresAt IS NOT NULL')
      .andWhere('reservation.expiresAt < :now', { now })
      .getMany();

    if (expiredReservations.length === 0) {
      return { processed: 0 };
    }

    let processed = 0;

    for (const reservation of expiredReservations) {
      await this.reservationsRepository.manager.transaction(async (manager) => {
        const repo = manager.getRepository(Reservation);
        const itemRepo = manager.getRepository(WishlistItem);

        const fresh = await repo.findOne({
          where: { id: reservation.id },
          relations: ['wishlistItem', 'reservedBy', 'event', 'event.organizer'],
        });

        if (!fresh || fresh.status !== ReservationStatus.ACTIVE) {
          return;
        }

        fresh.status = ReservationStatus.EXPIRED;
        fresh.releasedAt = new Date();
        fresh.releaseReason = 'EXPIRED';

        await repo.save(fresh);

        const remainingActive = await repo.count({
          where: {
            wishlistItem: { id: fresh.wishlistItem.id },
            status: ReservationStatus.ACTIVE,
          },
        });

        if (remainingActive === 0) {
          fresh.wishlistItem.isReserved = false;
          await itemRepo.save(fresh.wishlistItem);
        }

        await this.auditService.log({
          userId: fresh.reservedBy?.id ?? null,
          action: 'RESERVATION_EXPIRED',
          entityType: 'Reservation',
          entityId: fresh.id,
          metadata: {
            wishlistItemId: fresh.wishlistItem.id,
          },
        });

        try {
          if (fresh.reservedBy?.id && fresh.event?.id) {
            await this.notificationsService.create({
              userId: fresh.reservedBy.id,
              eventId: fresh.event.id,
              type: 'RESERVATION_EXPIRED',
              title: 'Réservation expirée',
              body: `Votre réservation pour "${fresh.wishlistItem.name}" a expiré après 24 heures.`,
              dataPayload: {
                reservationId: fresh.id,
                wishlistItemId: fresh.wishlistItem.id,
                eventId: fresh.event.id,
              },
            });
          }
        } catch (error) {
          this.logger.warn(
            `Reservation expiration notification failed | reservationId=${fresh.id} error=${error instanceof Error ? error.message : 'unknown'}`,
          );
        }

        try {
          const organizerId = fresh.event?.organizer?.id;

          if (
            organizerId &&
            organizerId !== fresh.reservedBy?.id &&
            fresh.event?.id
          ) {
            await this.notificationsService.create({
              userId: organizerId,
              eventId: fresh.event.id,
              type: 'EVENT_RESERVATION_EXPIRED',
              title: 'Réservation expirée sur votre événement',
              body: `La réservation de "${fresh.wishlistItem.name}" a expiré et l’item est de nouveau disponible.`,
              dataPayload: {
                reservationId: fresh.id,
                wishlistItemId: fresh.wishlistItem.id,
                eventId: fresh.event.id,
                reservedByUserId: fresh.reservedBy?.id ?? null,
              },
            });
          }
        } catch (error) {
          this.logger.warn(
            `Reservation expiration organizer notification failed | reservationId=${fresh.id} error=${error instanceof Error ? error.message : 'unknown'}`,
          );
        }

        processed++;
      });
    }

    return { processed };
  }
}
