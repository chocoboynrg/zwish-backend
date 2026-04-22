import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Payment } from './payment.entity';
import { PaymentWebhookEvent } from './payment-webhook-event.entity';
import { Contribution } from '../contributions/contribution.entity';
import { User } from '../users/user.entity';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus } from './enums/payment-status.enum';
import { ContributionStatus } from '../contributions/enums/contribution-status.enum';
import { MarkPaymentSucceededDto } from './dto/mark-payment-succeeded.dto';
import { MarkPaymentFailedDto } from './dto/mark-payment-failed.dto';
import { FundingStatus } from '../wishlist-items/enums/funding-status.enum';
import { Event } from '../events/event.entity';
import { EventParticipant } from '../participants/event-participant.entity';
import { ParticipantRole } from '../participants/enums/participant-role.enum';
import { ParticipantStatus } from '../participants/enums/participant-status.enum';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { AuditService } from '../audit/audit.service';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { AdminPaymentsQueryDto } from './dto/admin-payments-query.dto';
import { ReconciliationQueryDto } from './dto/reconciliation-query.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentWebhookEventsQueryDto } from './dto/payment-webhook-events-query.dto';
import { PlatformRole } from '../users/enums/platform-role.enum';

type CreatePaymentInternalInput = CreatePaymentDto & {
  payerUserId: number;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,

    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookEventsRepository: Repository<PaymentWebhookEvent>,

    @InjectRepository(Contribution)
    private readonly contributionsRepository: Repository<Contribution>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(WishlistItem)
    private readonly wishlistItemsRepository: Repository<WishlistItem>,

    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,

    @InjectRepository(EventParticipant)
    private readonly participantsRepository: Repository<EventParticipant>,

    private readonly notificationsService: NotificationsService,
    private readonly paymentProviderFactory: PaymentProviderFactory,
    private readonly auditService: AuditService,
  ) {}

  async create(createPaymentDto: CreatePaymentInternalInput): Promise<Payment> {
    const { contributionId, payerUserId, provider, paymentMethod } =
      createPaymentDto;

    const contribution = await this.contributionsRepository.findOne({
      where: { id: contributionId },
      relations: ['event', 'wishlistItem', 'contributor', 'payments'],
    });

    if (!contribution) {
      throw new NotFoundException('Contribution introuvable');
    }

    const payer = await this.usersRepository.findOne({
      where: { id: payerUserId },
    });

    if (!payer) {
      throw new NotFoundException('Utilisateur payeur introuvable');
    }

    if (contribution.contributor.id !== payer.id) {
      throw new BadRequestException(
        'Le payeur doit correspondre au contributeur de cette contribution',
      );
    }

    if (contribution.status === ContributionStatus.CONFIRMED) {
      throw new BadRequestException('Cette contribution est déjà confirmée');
    }

    const succeededPayment = contribution.payments?.find(
      (payment) => payment.status === PaymentStatus.SUCCEEDED,
    );

    if (succeededPayment) {
      throw new BadRequestException(
        'Un paiement réussi existe déjà pour cette contribution',
      );
    }

    this.logger.log(
      `Init payment start | contributionId=${contribution.id} payerUserId=${payer.id} provider=${provider} method=${paymentMethod}`,
    );

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    const payment = this.paymentsRepository.create({
      contribution,
      payer,
      provider,
      providerTransactionId: null,
      providerReference: null,
      paymentMethod,
      amount: contribution.amount,
      currencyCode: contribution.currencyCode,
      status: PaymentStatus.INITIATED,
      paymentUrl: null,
      failureReason: null,
      initiatedAt: now,
      expiresAt,
      confirmedAt: null,
      failedAt: null,
      refundedAt: null,
      rawProviderPayload: null,
    });

    const savedPayment = await this.paymentsRepository.save(payment);

    this.logger.log(
      `Payment row created | paymentId=${savedPayment.id} contributionId=${contribution.id} status=${savedPayment.status}`,
    );

    const providerAdapter = this.paymentProviderFactory.get(provider);

    const externalSession = await providerAdapter.createPaymentSession({
      paymentId: savedPayment.id,
      amount: Number(savedPayment.amount),
      currencyCode: savedPayment.currencyCode,
      paymentMethod: savedPayment.paymentMethod,
      description: `Paiement contribution #${contribution.id}`,
      customer: {
        id: payer.id,
        name: payer.name,
        email: payer.email,
      },
      metadata: {
        contributionId: contribution.id,
        eventId: contribution.event.id,
        wishlistItemId: contribution.wishlistItem.id,
        payerUserId: payer.id,
      },
    });

    this.logger.log(
      `Provider session created | paymentId=${savedPayment.id} provider=${externalSession.provider} reference=${externalSession.providerReference ?? 'null'} tx=${externalSession.providerTransactionId ?? 'null'} hasUrl=${externalSession.paymentUrl ? 'yes' : 'no'}`,
    );

    savedPayment.provider = externalSession.provider;
    savedPayment.providerReference = externalSession.providerReference ?? null;
    savedPayment.providerTransactionId =
      externalSession.providerTransactionId ?? null;
    savedPayment.paymentUrl = externalSession.paymentUrl ?? null;
    savedPayment.rawProviderPayload = externalSession.rawPayload
      ? JSON.stringify(externalSession.rawPayload)
      : null;

    const finalSavedPayment = await this.paymentsRepository.save(savedPayment);

    const fullPayment = await this.paymentsRepository.findOne({
      where: { id: finalSavedPayment.id },
      relations: ['contribution', 'payer'],
    });

    if (!fullPayment) {
      throw new NotFoundException('Paiement créé mais introuvable ensuite');
    }

    this.logger.log(
      `Payment initialized successfully | paymentId=${fullPayment.id} contributionId=${contribution.id} provider=${fullPayment.provider} status=${fullPayment.status}`,
    );

    await this.auditService.log({
      userId: payer.id,
      action: 'PAYMENT_CREATED',
      entityType: 'Payment',
      entityId: savedPayment.id,
      metadata: {
        amount: savedPayment.amount,
        provider: savedPayment.provider,
      },
    });

    return fullPayment;
  }

  async expirePendingPayments(): Promise<{
    scanned: number;
    expired: number;
  }> {
    this.logger.log('Pending payments cleanup started');

    const now = new Date();

    const stalePayments = await this.paymentsRepository.find({
      where: [
        { status: PaymentStatus.INITIATED },
        { status: PaymentStatus.PENDING },
      ],
      relations: ['contribution', 'payer'],
      order: { id: 'ASC' },
    });

    const candidates = stalePayments.filter((payment) => {
      if (!payment.expiresAt) {
        return false;
      }

      return payment.expiresAt.getTime() <= now.getTime();
    });

    let expired = 0;

    for (const payment of candidates) {
      const changed = await this.expireSinglePendingPayment(payment.id);
      if (changed) {
        expired += 1;
      }
    }

    this.logger.log(
      `Pending payments cleanup finished | scanned=${stalePayments.length} expired=${expired}`,
    );

    return {
      scanned: stalePayments.length,
      expired,
    };
  }

  private async expireSinglePendingPayment(
    paymentId: number,
  ): Promise<boolean> {
    return this.paymentsRepository.manager.transaction(async (manager) => {
      const paymentRepository = manager.getRepository(Payment);
      const contributionRepository = manager.getRepository(Contribution);

      const payment = await paymentRepository.findOne({
        where: { id: paymentId },
        relations: ['contribution', 'payer'],
      });

      if (!payment) {
        return false;
      }

      if (
        payment.status !== PaymentStatus.INITIATED &&
        payment.status !== PaymentStatus.PENDING
      ) {
        return false;
      }

      if (!payment.expiresAt || payment.expiresAt.getTime() > Date.now()) {
        return false;
      }

      payment.status = PaymentStatus.FAILED;
      payment.failedAt = new Date();
      payment.failureReason =
        payment.failureReason ?? 'Session de paiement expirée';

      this.logger.warn(
        `Payment expired automatically | paymentId=${payment.id} contributionId=${payment.contribution.id}`,
      );

      await paymentRepository.save(payment);

      try {
        const fullContribution = await contributionRepository.findOne({
          where: { id: payment.contribution.id },
          relations: [
            'event',
            'event.organizer',
            'wishlistItem',
            'contributor',
          ],
        });

        if (fullContribution) {
          await this.notificationsService.create({
            userId: fullContribution.contributor.id,
            eventId: fullContribution.event.id,
            type: 'PAYMENT_EXPIRED',
            title: 'Paiement expiré',
            body: `Votre session de paiement pour "${fullContribution.wishlistItem.name}" a expiré.`,
            dataPayload: {
              paymentId: payment.id,
              contributionId: fullContribution.id,
              eventId: fullContribution.event.id,
              wishlistItemId: fullContribution.wishlistItem.id,
            },
          });

          const organizerId = fullContribution.event.organizer?.id;
          if (organizerId && organizerId !== fullContribution.contributor.id) {
            await this.notificationsService.create({
              userId: organizerId,
              eventId: fullContribution.event.id,
              type: 'EVENT_PAYMENT_EXPIRED',
              title: 'Paiement expiré sur votre événement',
              body: `La tentative de paiement pour "${fullContribution.wishlistItem.name}" a expiré.`,
              dataPayload: {
                paymentId: payment.id,
                contributionId: fullContribution.id,
                contributorId: fullContribution.contributor.id,
                wishlistItemId: fullContribution.wishlistItem.id,
              },
            });
          }
        }
      } catch (error) {
        this.logger.warn(
          `Payment expiration notifications failed | paymentId=${payment.id} error=${error instanceof Error ? error.message : 'unknown'}`,
        );
      }

      const contribution = await contributionRepository.findOne({
        where: { id: payment.contribution.id },
      });

      if (
        contribution &&
        (contribution.status === ContributionStatus.AWAITING_PAYMENT ||
          contribution.status === ContributionStatus.PENDING)
      ) {
        contribution.status = ContributionStatus.FAILED;
        await contributionRepository.save(contribution);

        this.logger.warn(
          `Contribution expired after payment timeout | contributionId=${contribution.id} paymentId=${payment.id}`,
        );
      }

      return true;
    });
  }

  async findAccessiblePaginated(userId: number, query: PaymentsQueryDto) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
      status,
      provider,
    } = query;

    const qb = this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.contribution', 'contribution')
      .leftJoinAndSelect('contribution.event', 'event')
      .leftJoinAndSelect('payment.payer', 'payer');

    const managedEventIds = await this.getManagedEventIds(userId);

    if (managedEventIds.length > 0) {
      qb.andWhere(`(payer.id = :userId OR event.id IN (:...managedEventIds))`, {
        userId,
        managedEventIds,
      });
    } else {
      qb.andWhere(`payer.id = :userId`, { userId });
    }

    if (status) {
      qb.andWhere('payment.status = :status', { status });
    }

    if (provider) {
      qb.andWhere('payment.provider = :provider', { provider });
    }

    qb.orderBy(`payment.${sortBy}`, order as 'ASC' | 'DESC');

    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  async findOneAccessible(id: number, userId: number): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id },
      relations: ['contribution', 'contribution.event', 'payer'],
    });

    if (!payment) {
      throw new NotFoundException('Paiement introuvable');
    }

    if (payment.payer.id === userId) {
      return payment;
    }

    const canManage = await this.canManageEvent(
      userId,
      payment.contribution.event.id,
    );

    if (!canManage) {
      throw new ForbiddenException('Vous ne pouvez pas consulter ce paiement');
    }

    return payment;
  }

  async findAll(): Promise<Payment[]> {
    return await this.paymentsRepository.find({
      relations: ['contribution', 'payer'],
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id },
      relations: ['contribution', 'payer'],
    });

    if (!payment) {
      throw new NotFoundException('Paiement introuvable');
    }

    return payment;
  }

  async markAsSucceeded(
    id: number,
    markPaymentSucceededDto: MarkPaymentSucceededDto,
  ): Promise<Payment> {
    const updatedPayment = await this.paymentsRepository.manager.transaction(
      async (manager) => {
        const paymentRepository = manager.getRepository(Payment);
        const contributionRepository = manager.getRepository(Contribution);
        const wishlistItemRepository = manager.getRepository(WishlistItem);

        const payment = await paymentRepository.findOne({
          where: { id },
          relations: ['contribution', 'payer'],
        });

        if (!payment) {
          throw new NotFoundException('Paiement introuvable');
        }

        this.logger.log(
          `Mark payment success requested | paymentId=${id} currentStatus=${payment.status}`,
        );

        if (payment.status === PaymentStatus.SUCCEEDED) {
          this.logger.warn(
            `Payment already succeeded | paymentId=${payment.id}`,
          );
          return payment;
        }

        if (
          payment.status === PaymentStatus.FAILED ||
          payment.status === PaymentStatus.CANCELLED ||
          payment.status === PaymentStatus.REFUNDED
        ) {
          throw new BadRequestException(
            'Ce paiement ne peut plus être marqué comme réussi',
          );
        }

        const contribution = await contributionRepository.findOne({
          where: { id: payment.contribution.id },
          relations: [
            'wishlistItem',
            'event',
            'event.organizer',
            'contributor',
          ],
        });

        if (!contribution) {
          throw new NotFoundException('Contribution introuvable');
        }

        if (contribution.status === ContributionStatus.CONFIRMED) {
          payment.status = PaymentStatus.SUCCEEDED;
          payment.confirmedAt = payment.confirmedAt ?? new Date();
          payment.providerTransactionId =
            markPaymentSucceededDto.providerTransactionId ??
            payment.providerTransactionId;
          payment.providerReference =
            markPaymentSucceededDto.providerReference ??
            payment.providerReference;

          await paymentRepository.save(payment);

          const alreadyUpdated = await paymentRepository.findOne({
            where: { id: payment.id },
            relations: [
              'contribution',
              'contribution.event',
              'contribution.wishlistItem',
              'payer',
            ],
          });

          if (!alreadyUpdated) {
            throw new NotFoundException(
              'Paiement introuvable après mise à jour',
            );
          }

          return alreadyUpdated;
        }

        if (
          contribution.status !== ContributionStatus.AWAITING_PAYMENT &&
          contribution.status !== ContributionStatus.PENDING
        ) {
          throw new BadRequestException(
            'Seules les contributions en attente peuvent être confirmées',
          );
        }

        const wishlistItem = await wishlistItemRepository.findOne({
          where: { id: contribution.wishlistItem.id },
        });

        if (!wishlistItem) {
          throw new NotFoundException('Wishlist item introuvable');
        }

        const targetAmount = Number(wishlistItem.targetAmount ?? 0);
        const fundedAmount = Number(wishlistItem.fundedAmount ?? 0);
        const contributionAmount = Number(contribution.amount ?? 0);

        if (targetAmount <= 0) {
          throw new BadRequestException(
            "Cet item n'a pas de montant cible valide",
          );
        }

        if (wishlistItem.fundingStatus === FundingStatus.FUNDED) {
          throw new BadRequestException('Cet item est déjà totalement financé');
        }

        if (fundedAmount + contributionAmount > targetAmount) {
          throw new BadRequestException(
            'Cette confirmation dépasse le montant cible de l’item',
          );
        }

        payment.status = PaymentStatus.SUCCEEDED;
        payment.confirmedAt = new Date();
        payment.failedAt = null;
        payment.failureReason = null;
        payment.providerTransactionId =
          markPaymentSucceededDto.providerTransactionId ??
          payment.providerTransactionId;
        payment.providerReference =
          markPaymentSucceededDto.providerReference ??
          payment.providerReference;

        await paymentRepository.save(payment);

        this.logger.log(
          `Payment marked as SUCCEEDED | paymentId=${payment.id} contributionId=${contribution.id}`,
        );

        contribution.status = ContributionStatus.CONFIRMED;
        contribution.confirmedAt = new Date();

        await contributionRepository.save(contribution);

        this.logger.log(
          `Contribution marked as CONFIRMED | contributionId=${contribution.id} paymentId=${payment.id}`,
        );

        await this.recalculateWishlistItemFundingInTransaction(
          contribution.wishlistItem.id,
          contributionRepository,
          wishlistItemRepository,
        );

        this.logger.log(
          `Wishlist funding recalculated | wishlistItemId=${contribution.wishlistItem.id} paymentId=${payment.id}`,
        );

        const finalPayment = await paymentRepository.findOne({
          where: { id: payment.id },
          relations: ['contribution', 'contribution.event', 'payer'],
        });

        if (!finalPayment) {
          throw new NotFoundException(
            'Paiement marqué réussi mais introuvable ensuite',
          );
        }
        return finalPayment;
      },
    );

    this.logger.log(
      `Payment success transaction committed | paymentId=${updatedPayment.id} contributionId=${updatedPayment.contribution.id}`,
    );

    try {
      const contribution = await this.contributionsRepository.findOne({
        where: { id: updatedPayment.contribution.id },
        relations: ['event', 'event.organizer', 'wishlistItem', 'contributor'],
      });

      if (contribution) {
        await this.notificationsService.create({
          userId: contribution.contributor.id,
          eventId: contribution.event.id,
          type: 'PAYMENT_SUCCEEDED',
          title: 'Paiement confirmé',
          body: `Votre paiement pour "${contribution.wishlistItem.name}" a été confirmé avec succès.`,
          dataPayload: {
            paymentId: updatedPayment.id,
            contributionId: contribution.id,
            eventId: contribution.event.id,
            wishlistItemId: contribution.wishlistItem.id,
          },
        });

        const organizerId = contribution.event.organizer?.id;
        if (organizerId && organizerId !== contribution.contributor.id) {
          await this.notificationsService.create({
            userId: organizerId,
            eventId: contribution.event.id,
            type: 'EVENT_CONTRIBUTION_PAID',
            title: 'Nouvelle contribution payée',
            body: `Une contribution pour "${contribution.wishlistItem.name}" vient d’être payée.`,
            dataPayload: {
              paymentId: updatedPayment.id,
              contributionId: contribution.id,
              contributorId: contribution.contributor.id,
              wishlistItemId: contribution.wishlistItem.id,
            },
          });
        }
      }
    } catch (error) {
      this.logger.warn(
        `Payment success notifications failed | paymentId=${updatedPayment.id} error=${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    await this.auditService.log({
      userId: updatedPayment.payer.id,
      action: 'PAYMENT_SUCCEEDED',
      entityType: 'Payment',
      entityId: updatedPayment.id,
    });

    return updatedPayment;
  }

  async markAsFailed(
    id: number,
    markPaymentFailedDto: MarkPaymentFailedDto,
  ): Promise<Payment> {
    const updatedPayment = await this.paymentsRepository.manager.transaction(
      async (manager) => {
        const paymentRepository = manager.getRepository(Payment);
        const contributionRepository = manager.getRepository(Contribution);

        const payment = await paymentRepository.findOne({
          where: { id },
          relations: ['contribution', 'payer'],
        });

        if (!payment) {
          throw new NotFoundException('Paiement introuvable');
        }

        this.logger.log(
          `Mark payment failed requested | paymentId=${id} currentStatus=${payment.status}`,
        );

        if (payment.status === PaymentStatus.SUCCEEDED) {
          throw new BadRequestException(
            'Un paiement réussi ne peut pas être marqué comme échoué',
          );
        }

        if (payment.status === PaymentStatus.FAILED) {
          this.logger.warn(`Payment already failed | paymentId=${payment.id}`);
          return payment;
        }

        payment.status = PaymentStatus.FAILED;
        payment.failedAt = new Date();
        payment.failureReason =
          markPaymentFailedDto.failureReason ?? 'Échec du paiement';

        await paymentRepository.save(payment);

        this.logger.warn(
          `Payment marked as FAILED | paymentId=${payment.id} reason=${payment.failureReason ?? 'unknown'}`,
        );

        const contribution = await contributionRepository.findOne({
          where: { id: payment.contribution.id },
        });

        if (!contribution) {
          throw new NotFoundException('Contribution introuvable');
        }

        if (
          contribution.status === ContributionStatus.AWAITING_PAYMENT ||
          contribution.status === ContributionStatus.PENDING
        ) {
          contribution.status = ContributionStatus.FAILED;
          await contributionRepository.save(contribution);

          this.logger.warn(
            `Contribution marked as FAILED after payment failure | contributionId=${contribution.id} paymentId=${payment.id}`,
          );
        }

        const finalPayment = await paymentRepository.findOne({
          where: { id: payment.id },
          relations: ['contribution', 'payer'],
        });

        if (!finalPayment) {
          throw new NotFoundException('Paiement introuvable après update');
        }

        return finalPayment;
      },
    );

    this.logger.warn(
      `Payment failure transaction committed | paymentId=${updatedPayment.id} contributionId=${updatedPayment.contribution.id}`,
    );

    await this.auditService.log({
      userId: updatedPayment.payer.id,
      action: 'PAYMENT_FAILED',
      entityType: 'Payment',
      entityId: updatedPayment.id,
    });

    try {
      const contribution = await this.contributionsRepository.findOne({
        where: { id: updatedPayment.contribution.id },
        relations: ['event', 'event.organizer', 'wishlistItem', 'contributor'],
      });

      if (contribution) {
        await this.notificationsService.create({
          userId: contribution.contributor.id,
          eventId: contribution.event.id,
          type: 'PAYMENT_FAILED',
          title: 'Paiement échoué',
          body: `Le paiement pour "${contribution.wishlistItem.name}" a échoué.`,
          dataPayload: {
            paymentId: updatedPayment.id,
            contributionId: contribution.id,
            eventId: contribution.event.id,
            wishlistItemId: contribution.wishlistItem.id,
          },
        });

        const organizerId = contribution.event.organizer?.id;
        if (organizerId && organizerId !== contribution.contributor.id) {
          await this.notificationsService.create({
            userId: organizerId,
            eventId: contribution.event.id,
            type: 'EVENT_PAYMENT_FAILED',
            title: 'Paiement échoué sur votre événement',
            body: `Une tentative de paiement pour "${contribution.wishlistItem.name}" a échoué.`,
            dataPayload: {
              paymentId: updatedPayment.id,
              contributionId: contribution.id,
              contributorId: contribution.contributor.id,
              wishlistItemId: contribution.wishlistItem.id,
            },
          });
        }
      }
    } catch (error) {
      this.logger.warn(
        `Payment failure notifications failed | paymentId=${updatedPayment.id} error=${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    return updatedPayment;
  }

  async handleWebhook(webhookDto: PaymentWebhookDto) {
    const {
      provider,
      paymentId,
      status,
      providerTransactionId,
      providerReference,
      failureReason,
      rawPayload,
    } = webhookDto;

    this.logger.log(
      `Webhook received | provider=${provider} paymentId=${paymentId} status=${status} tx=${providerTransactionId ?? 'null'} ref=${providerReference ?? 'null'}`,
    );

    if (!provider) {
      throw new BadRequestException('provider est requis');
    }

    if (!paymentId || Number(paymentId) <= 0) {
      throw new BadRequestException('paymentId invalide');
    }

    if (status !== 'SUCCEEDED' && status !== 'FAILED') {
      throw new BadRequestException('status doit être SUCCEEDED ou FAILED');
    }

    const eventKey = this.buildWebhookEventKey(webhookDto);

    const alreadyProcessed = await this.webhookEventsRepository.findOne({
      where: { eventKey },
      relations: ['payment'],
    });

    if (alreadyProcessed) {
      this.logger.warn(
        `Webhook duplicate ignored | paymentId=${alreadyProcessed.payment.id} eventKey=${eventKey}`,
      );
      return {
        message: 'Webhook déjà traité',
        paymentId: alreadyProcessed.payment.id,
        status: alreadyProcessed.resultingPaymentStatus,
        idempotent: true,
      };
    }

    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
      relations: ['contribution', 'payer'],
    });

    if (!payment) {
      throw new NotFoundException('Paiement introuvable');
    }

    payment.rawProviderPayload = rawPayload
      ? JSON.stringify(rawPayload)
      : payment.rawProviderPayload;

    await this.paymentsRepository.save(payment);

    const webhookEvent = this.webhookEventsRepository.create({
      payment,
      provider,
      eventKey,
      externalStatus: status,
      providerTransactionId: providerTransactionId ?? null,
      providerReference: providerReference ?? null,
      failureReason: failureReason ?? null,
      rawPayload: rawPayload ? JSON.stringify(rawPayload) : null,
      processedAt: null,
      resultingPaymentStatus: null,
    });

    try {
      await this.webhookEventsRepository.save(webhookEvent);
      this.logger.log(
        `Webhook event stored | paymentId=${payment.id} eventKey=${eventKey} status=${status}`,
      );
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const existing = await this.webhookEventsRepository.findOne({
          where: { eventKey },
          relations: ['payment'],
        });

        if (existing) {
          this.logger.warn(
            `Webhook duplicate race detected | paymentId=${existing.payment.id} eventKey=${eventKey}`,
          );
          return {
            message: 'Webhook déjà traité',
            paymentId: existing.payment.id,
            status: existing.resultingPaymentStatus,
            idempotent: true,
          };
        }
      }

      throw error;
    }

    if (status === 'SUCCEEDED') {
      const updated = await this.markAsSucceeded(paymentId, {
        providerTransactionId,
        providerReference,
      });

      webhookEvent.processedAt = new Date();
      webhookEvent.resultingPaymentStatus = updated.status;
      await this.webhookEventsRepository.save(webhookEvent);

      this.logger.log(
        `Webhook processed as success | paymentId=${updated.id} eventKey=${eventKey}`,
      );

      return {
        message: 'Webhook succès traité',
        paymentId: updated.id,
        status: updated.status,
        idempotent: false,
      };
    }

    const updated = await this.markAsFailed(paymentId, {
      failureReason: failureReason ?? `Paiement échoué via ${provider}`,
    });

    webhookEvent.processedAt = new Date();
    webhookEvent.resultingPaymentStatus = updated.status;
    await this.webhookEventsRepository.save(webhookEvent);

    this.logger.warn(
      `Webhook processed as failure | paymentId=${updated.id} eventKey=${eventKey}`,
    );

    await this.auditService.log({
      action: 'PAYMENT_WEBHOOK_RECEIVED',
      entityType: 'Payment',
      entityId: paymentId,
      metadata: {
        provider,
        status,
      },
    });

    return {
      message: 'Webhook échec traité',
      paymentId: updated.id,
      status: updated.status,
      idempotent: false,
    };
  }

  async getMyPaymentsPaginated(userId: number, query: PaymentsQueryDto) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
      status,
      provider,
    } = query;

    const qb = this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.contribution', 'contribution')
      .leftJoinAndSelect('contribution.event', 'event')
      .leftJoinAndSelect('contribution.wishlistItem', 'wishlistItem')
      .leftJoinAndSelect('payment.payer', 'payer')
      .where('payer.id = :userId', { userId });

    if (status) {
      qb.andWhere('payment.status = :status', { status });
    }

    if (provider) {
      qb.andWhere('payment.provider = :provider', { provider });
    }

    qb.orderBy(`payment.${sortBy}`, order as 'ASC' | 'DESC');

    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [payments, total] = await qb.getManyAndCount();

    const items = payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      providerTransactionId: payment.providerTransactionId,
      providerReference: payment.providerReference,
      paymentMethod: payment.paymentMethod,
      amount: Number(payment.amount),
      currencyCode: payment.currencyCode,
      status: payment.status,
      paymentUrl: payment.paymentUrl,
      failureReason: payment.failureReason,
      initiatedAt: payment.initiatedAt,
      expiresAt: payment.expiresAt,
      confirmedAt: payment.confirmedAt,
      failedAt: payment.failedAt,
      refundedAt: payment.refundedAt,
      createdAt: payment.createdAt,
      contribution: payment.contribution
        ? {
            id: payment.contribution.id,
            status: payment.contribution.status,
            amount: Number(payment.contribution.amount),
            event: payment.contribution.event
              ? {
                  id: payment.contribution.event.id,
                  title: payment.contribution.event.title,
                  eventDate: payment.contribution.event.eventDate,
                }
              : null,
            wishlistItem: payment.contribution.wishlistItem
              ? {
                  id: payment.contribution.wishlistItem.id,
                  title: payment.contribution.wishlistItem.name,
                  fundingStatus:
                    payment.contribution.wishlistItem.fundingStatus,
                }
              : null,
          }
        : null,
    }));

    const succeeded = items.filter(
      (item) => item.status === PaymentStatus.SUCCEEDED,
    );
    const pending = items.filter(
      (item) =>
        item.status === PaymentStatus.INITIATED ||
        item.status === PaymentStatus.PENDING,
    );
    const failed = items.filter((item) => item.status === PaymentStatus.FAILED);

    return {
      items,
      total,
      summary: {
        page,
        limit,
        totalCount: total,
        succeededCount: succeeded.length,
        pendingCount: pending.length,
        failedCount: failed.length,
        totalSucceededAmount: succeeded.reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0,
        ),
        currencyCode: items[0]?.currencyCode ?? 'XOF',
      },
    };
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

  private async recalculateWishlistItemFundingInTransaction(
    wishlistItemId: number,
    contributionRepository: Repository<Contribution>,
    wishlistItemRepository: Repository<WishlistItem>,
  ): Promise<void> {
    const wishlistItem = await wishlistItemRepository.findOne({
      where: { id: wishlistItemId },
    });

    if (!wishlistItem) {
      throw new NotFoundException('Wishlist item introuvable');
    }

    const result = await contributionRepository
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

    await wishlistItemRepository.save(wishlistItem);
  }

  private buildWebhookEventKey(webhookDto: PaymentWebhookDto): string {
    const normalized = {
      provider: webhookDto.provider,
      paymentId: webhookDto.paymentId,
      status: webhookDto.status,
      providerTransactionId: webhookDto.providerTransactionId ?? null,
      providerReference: webhookDto.providerReference ?? null,
      failureReason: webhookDto.failureReason ?? null,
      rawPayload: webhookDto.rawPayload ?? null,
    };

    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  async getAdminPayments(query: AdminPaymentsQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'DESC',
      status,
      provider,
      payerUserId,
      eventId,
      contributionId,
    } = query;

    const allowedSortFields = new Set([
      'createdAt',
      'updatedAt',
      'amount',
      'status',
      'provider',
      'initiatedAt',
      'confirmedAt',
      'failedAt',
    ]);

    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';

    const qb = this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.payer', 'payer')
      .leftJoinAndSelect('payment.contribution', 'contribution')
      .leftJoinAndSelect('contribution.event', 'event')
      .leftJoinAndSelect('contribution.wishlistItem', 'wishlistItem');

    if (status) {
      qb.andWhere('payment.status = :status', { status });
    }

    if (provider) {
      qb.andWhere('payment.provider = :provider', { provider });
    }

    if (payerUserId) {
      qb.andWhere('payer.id = :payerUserId', { payerUserId });
    }

    if (eventId) {
      qb.andWhere('event.id = :eventId', { eventId });
    }

    if (contributionId) {
      qb.andWhere('contribution.id = :contributionId', { contributionId });
    }

    qb.orderBy(`payment.${safeSortBy}`, order as 'ASC' | 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [payments, total] = await qb.getManyAndCount();

    const items = payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      providerTransactionId: payment.providerTransactionId,
      providerReference: payment.providerReference,
      paymentMethod: payment.paymentMethod,
      amount: Number(payment.amount),
      currencyCode: payment.currencyCode,
      status: payment.status,
      paymentUrl: payment.paymentUrl,
      failureReason: payment.failureReason,
      initiatedAt: payment.initiatedAt,
      expiresAt: payment.expiresAt,
      confirmedAt: payment.confirmedAt,
      failedAt: payment.failedAt,
      refundedAt: payment.refundedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      payer: payment.payer
        ? {
            id: payment.payer.id,
            name: payment.payer.name,
            email: payment.payer.email,
          }
        : null,
      contribution: payment.contribution
        ? {
            id: payment.contribution.id,
            status: payment.contribution.status,
            amount: Number(payment.contribution.amount),
            event: payment.contribution.event
              ? {
                  id: payment.contribution.event.id,
                  title: payment.contribution.event.title,
                  eventDate: payment.contribution.event.eventDate,
                }
              : null,
            wishlistItem: payment.contribution.wishlistItem
              ? {
                  id: payment.contribution.wishlistItem.id,
                  title: payment.contribution.wishlistItem.name,
                }
              : null,
          }
        : null,
    }));

    const succeededCount = items.filter(
      (item) => item.status === PaymentStatus.SUCCEEDED,
    ).length;

    const pendingCount = items.filter(
      (item) =>
        item.status === PaymentStatus.INITIATED ||
        item.status === PaymentStatus.PENDING,
    ).length;

    const failedCount = items.filter(
      (item) => item.status === PaymentStatus.FAILED,
    ).length;

    const refundedCount = items.filter(
      (item) => item.status === PaymentStatus.REFUNDED,
    ).length;

    return {
      items,
      total,
      summary: {
        page,
        limit,
        totalCount: total,
        succeededCount,
        pendingCount,
        failedCount,
        refundedCount,
      },
    };
  }

  async getAdminPaymentById(id: number) {
    const payment = await this.paymentsRepository.findOne({
      where: { id },
      relations: [
        'payer',
        'contribution',
        'contribution.event',
        'contribution.wishlistItem',
      ],
    });

    if (!payment) {
      throw new NotFoundException('Paiement introuvable');
    }

    return {
      id: payment.id,
      provider: payment.provider,
      providerTransactionId: payment.providerTransactionId,
      providerReference: payment.providerReference,
      paymentMethod: payment.paymentMethod,
      amount: Number(payment.amount),
      currencyCode: payment.currencyCode,
      status: payment.status,
      paymentUrl: payment.paymentUrl,
      failureReason: payment.failureReason,
      initiatedAt: payment.initiatedAt,
      expiresAt: payment.expiresAt,
      confirmedAt: payment.confirmedAt,
      failedAt: payment.failedAt,
      refundedAt: payment.refundedAt,
      rawProviderPayload: payment.rawProviderPayload,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      payer: payment.payer
        ? {
            id: payment.payer.id,
            name: payment.payer.name,
            email: payment.payer.email,
          }
        : null,
      contribution: payment.contribution
        ? {
            id: payment.contribution.id,
            status: payment.contribution.status,
            amount: Number(payment.contribution.amount),
            event: payment.contribution.event
              ? {
                  id: payment.contribution.event.id,
                  title: payment.contribution.event.title,
                  eventDate: payment.contribution.event.eventDate,
                }
              : null,
            wishlistItem: payment.contribution.wishlistItem
              ? {
                  id: payment.contribution.wishlistItem.id,
                  title: payment.contribution.wishlistItem.name,
                }
              : null,
          }
        : null,
    };
  }

  async getPaymentWebhookEvents(
    paymentId: number,
    query: PaymentWebhookEventsQueryDto,
  ) {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
      select: ['id'],
    });

    if (!payment) {
      throw new NotFoundException('Paiement introuvable');
    }

    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'DESC',
      externalStatus,
      provider,
    } = query;

    const allowedSortFields = new Set([
      'createdAt',
      'processedAt',
      'externalStatus',
      'provider',
    ]);

    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';

    const qb = this.webhookEventsRepository
      .createQueryBuilder('event')
      .leftJoin('event.payment', 'payment')
      .where('payment.id = :paymentId', { paymentId });

    if (externalStatus) {
      qb.andWhere('event.externalStatus = :externalStatus', { externalStatus });
    }

    if (provider) {
      qb.andWhere('event.provider = :provider', { provider });
    }

    qb.orderBy(`event.${safeSortBy}`, order as 'ASC' | 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [events, total] = await qb.getManyAndCount();

    return {
      items: events.map((event) => ({
        id: event.id,
        provider: event.provider,
        eventKey: event.eventKey,
        externalStatus: event.externalStatus,
        providerTransactionId: event.providerTransactionId,
        providerReference: event.providerReference,
        failureReason: event.failureReason,
        processedAt: event.processedAt,
        resultingPaymentStatus: event.resultingPaymentStatus,
        createdAt: event.createdAt,
      })),
      total,
      summary: {
        page,
        limit,
        totalCount: total,
        succeededCount: events.filter((e) => e.externalStatus === 'SUCCEEDED')
          .length,
        failedCount: events.filter((e) => e.externalStatus === 'FAILED').length,
      },
    };
  }

  async getReconciliationReport(query: ReconciliationQueryDto) {
    const {
      page = 1,
      limit = 20,
      issueType,
      severity,
      paymentId,
      contributionId,
      eventId,
    } = query;

    const now = new Date();

    const payments = await this.paymentsRepository.find({
      relations: [
        'payer',
        'contribution',
        'contribution.event',
        'contribution.wishlistItem',
      ],
      order: { createdAt: 'DESC' },
    });

    const webhookEvents = await this.webhookEventsRepository.find({
      relations: ['payment'],
      order: { createdAt: 'DESC' },
    });

    const issues: Array<{
      type: string;
      severity: 'high' | 'medium' | 'low';
      paymentId?: number | null;
      contributionId?: number | null;
      eventId?: number | null;
      message: string;
      details?: Record<string, unknown>;
      createdAt?: Date | null;
    }> = [];

    const webhookByPaymentId = new Map<number, typeof webhookEvents>();
    for (const event of webhookEvents) {
      const relatedPaymentId = event.payment?.id;
      if (!relatedPaymentId) continue;
      const list = webhookByPaymentId.get(relatedPaymentId) ?? [];
      list.push(event);
      webhookByPaymentId.set(relatedPaymentId, list);
    }

    for (const payment of payments) {
      const relatedWebhooks = webhookByPaymentId.get(payment.id) ?? [];
      const latestWebhook = relatedWebhooks[0] ?? null;
      const contribution = payment.contribution ?? null;

      if (
        latestWebhook &&
        latestWebhook.externalStatus === 'SUCCEEDED' &&
        payment.status !== PaymentStatus.SUCCEEDED
      ) {
        issues.push({
          type: 'PAYMENT_WEBHOOK_MISMATCH',
          severity: 'high',
          paymentId: payment.id,
          contributionId: contribution?.id ?? null,
          eventId: contribution?.event?.id ?? null,
          message:
            'Webhook de succès reçu, mais le paiement n’est pas marqué comme SUCCEEDED.',
          details: {
            paymentStatus: payment.status,
            latestWebhookStatus: latestWebhook.externalStatus,
            resultingPaymentStatus: latestWebhook.resultingPaymentStatus,
          },
          createdAt: latestWebhook.createdAt,
        });
      }

      if (
        payment.status === PaymentStatus.SUCCEEDED &&
        contribution &&
        contribution.status !== ContributionStatus.CONFIRMED
      ) {
        issues.push({
          type: 'CONTRIBUTION_MISMATCH',
          severity: 'high',
          paymentId: payment.id,
          contributionId: contribution.id,
          eventId: contribution.event?.id ?? null,
          message: 'Paiement SUCCEEDED mais contribution non CONFIRMED.',
          details: {
            paymentStatus: payment.status,
            contributionStatus: contribution.status,
          },
          createdAt: payment.updatedAt ?? payment.createdAt,
        });
      }

      if (
        [PaymentStatus.INITIATED, PaymentStatus.PENDING].includes(
          payment.status,
        ) &&
        payment.expiresAt &&
        payment.expiresAt.getTime() < now.getTime()
      ) {
        issues.push({
          type: 'EXPIRED_PENDING_ANOMALY',
          severity: 'medium',
          paymentId: payment.id,
          contributionId: contribution?.id ?? null,
          eventId: contribution?.event?.id ?? null,
          message:
            'Paiement encore pending/initiated alors que la date d’expiration est dépassée.',
          details: {
            paymentStatus: payment.status,
            expiresAt: payment.expiresAt,
          },
          createdAt: payment.updatedAt ?? payment.createdAt,
        });
      }

      if (relatedWebhooks.length > 1) {
        issues.push({
          type: 'DUPLICATE_WEBHOOK_SIGNALS',
          severity: 'low',
          paymentId: payment.id,
          contributionId: contribution?.id ?? null,
          eventId: contribution?.event?.id ?? null,
          message: 'Plusieurs événements webhook détectés pour ce paiement.',
          details: {
            webhookCount: relatedWebhooks.length,
            latestWebhookStatus: latestWebhook?.externalStatus ?? null,
          },
          createdAt: latestWebhook?.createdAt ?? payment.createdAt,
        });
      }
    }

    const confirmedContributions = await this.contributionsRepository.find({
      where: { status: ContributionStatus.CONFIRMED },
      relations: ['event', 'wishlistItem', 'payments'],
      order: { id: 'DESC' },
    });

    for (const contribution of confirmedContributions) {
      const hasSucceededPayment = (contribution.payments ?? []).some(
        (payment) => payment.status === PaymentStatus.SUCCEEDED,
      );

      if (!hasSucceededPayment) {
        issues.push({
          type: 'ORPHAN_SUCCESS',
          severity: 'high',
          paymentId: null,
          contributionId: contribution.id,
          eventId: contribution.event?.id ?? null,
          message: 'Contribution CONFIRMED sans paiement SUCCEEDED associé.',
          details: {
            contributionStatus: contribution.status,
            paymentCount: contribution.payments?.length ?? 0,
          },
          createdAt: contribution.updatedAt ?? contribution.createdAt,
        });
      }
    }

    let filtered = issues;

    if (issueType) {
      filtered = filtered.filter((issue) => issue.type === issueType);
    }

    if (severity) {
      filtered = filtered.filter((issue) => issue.severity === severity);
    }

    if (paymentId) {
      filtered = filtered.filter((issue) => issue.paymentId === paymentId);
    }

    if (contributionId) {
      filtered = filtered.filter(
        (issue) => issue.contributionId === contributionId,
      );
    }

    if (eventId) {
      filtered = filtered.filter((issue) => issue.eventId === eventId);
    }

    filtered.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginatedItems = filtered.slice(start, start + limit);

    return {
      items: paginatedItems,
      total,
      summary: {
        page,
        limit,
        totalCount: total,
        highSeverityCount: filtered.filter((i) => i.severity === 'high').length,
        mediumSeverityCount: filtered.filter((i) => i.severity === 'medium')
          .length,
        lowSeverityCount: filtered.filter((i) => i.severity === 'low').length,
        paymentWebhookMismatchCount: filtered.filter(
          (i) => i.type === 'PAYMENT_WEBHOOK_MISMATCH',
        ).length,
        contributionMismatchCount: filtered.filter(
          (i) => i.type === 'CONTRIBUTION_MISMATCH',
        ).length,
        orphanSuccessCount: filtered.filter((i) => i.type === 'ORPHAN_SUCCESS')
          .length,
        expiredPendingAnomalyCount: filtered.filter(
          (i) => i.type === 'EXPIRED_PENDING_ANOMALY',
        ).length,
        duplicateWebhookSignalsCount: filtered.filter(
          (i) => i.type === 'DUPLICATE_WEBHOOK_SIGNALS',
        ).length,
      },
    };
  }

  async getPaymentReconciliationDetail(paymentId: number) {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
      relations: [
        'payer',
        'contribution',
        'contribution.event',
        'contribution.wishlistItem',
      ],
    });

    if (!payment) {
      throw new NotFoundException('Paiement introuvable');
    }

    const webhooks = await this.webhookEventsRepository.find({
      where: { payment: { id: paymentId } },
      order: { createdAt: 'DESC' },
    });

    const contribution = payment.contribution ?? null;

    const checks = {
      paymentSucceededMatchesContribution:
        payment.status !== PaymentStatus.SUCCEEDED ||
        contribution?.status === ContributionStatus.CONFIRMED,
      paymentExpiredConsistency:
        ![PaymentStatus.INITIATED, PaymentStatus.PENDING].includes(
          payment.status,
        ) ||
        !payment.expiresAt ||
        payment.expiresAt.getTime() >= Date.now(),
      webhookSuccessConsistency:
        !webhooks.some((w) => w.externalStatus === 'SUCCEEDED') ||
        payment.status === PaymentStatus.SUCCEEDED,
    };

    return {
      payment: {
        id: payment.id,
        status: payment.status,
        provider: payment.provider,
        providerTransactionId: payment.providerTransactionId,
        providerReference: payment.providerReference,
        amount: Number(payment.amount),
        currencyCode: payment.currencyCode,
        initiatedAt: payment.initiatedAt,
        expiresAt: payment.expiresAt,
        confirmedAt: payment.confirmedAt,
        failedAt: payment.failedAt,
        refundedAt: payment.refundedAt,
        failureReason: payment.failureReason,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
      payer: payment.payer
        ? {
            id: payment.payer.id,
            name: payment.payer.name,
            email: payment.payer.email,
          }
        : null,
      contribution: contribution
        ? {
            id: contribution.id,
            status: contribution.status,
            amount: Number(contribution.amount),
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
                  title: contribution.wishlistItem.name,
                }
              : null,
          }
        : null,
      webhooks: webhooks.map((event) => ({
        id: event.id,
        provider: event.provider,
        externalStatus: event.externalStatus,
        resultingPaymentStatus: event.resultingPaymentStatus,
        providerTransactionId: event.providerTransactionId,
        providerReference: event.providerReference,
        failureReason: event.failureReason,
        processedAt: event.processedAt,
        createdAt: event.createdAt,
      })),
      checks,
    };
  }

  async refundPayment(
    id: number,
    refundPaymentDto: RefundPaymentDto,
  ): Promise<Payment> {
    const updatedPayment = await this.paymentsRepository.manager.transaction(
      async (manager) => {
        const paymentRepository = manager.getRepository(Payment);
        const contributionRepository = manager.getRepository(Contribution);
        const wishlistItemRepository = manager.getRepository(WishlistItem);

        const payment = await paymentRepository.findOne({
          where: { id },
          relations: ['contribution', 'payer'],
        });

        if (!payment) {
          throw new NotFoundException('Paiement introuvable');
        }

        this.logger.warn(
          `Refund payment requested | paymentId=${id} currentStatus=${payment.status}`,
        );

        if (payment.status === PaymentStatus.REFUNDED) {
          throw new BadRequestException('Paiement déjà remboursé');
        }

        if (payment.status !== PaymentStatus.SUCCEEDED) {
          throw new BadRequestException(
            'Seuls les paiements SUCCEEDED peuvent être remboursés',
          );
        }

        const contribution = await contributionRepository.findOne({
          where: { id: payment.contribution.id },
          relations: ['wishlistItem', 'event', 'contributor'],
        });

        if (!contribution) {
          throw new NotFoundException('Contribution introuvable');
        }

        payment.status = PaymentStatus.REFUNDED;
        payment.refundedAt = new Date();
        payment.failureReason =
          refundPaymentDto.reason?.trim() || 'Paiement remboursé';

        await paymentRepository.save(payment);

        contribution.status = ContributionStatus.REFUNDED;
        contribution.cancelledAt = new Date();

        await contributionRepository.save(contribution);

        await this.recalculateWishlistItemFundingInTransaction(
          contribution.wishlistItem.id,
          contributionRepository,
          wishlistItemRepository,
        );

        const finalPayment = await paymentRepository.findOne({
          where: { id: payment.id },
          relations: ['contribution', 'contribution.event', 'payer'],
        });

        if (!finalPayment) {
          throw new NotFoundException(
            'Paiement remboursé mais introuvable ensuite',
          );
        }

        return finalPayment;
      },
    );

    this.logger.warn(
      `Payment refunded successfully | paymentId=${updatedPayment.id} contributionId=${updatedPayment.contribution.id}`,
    );

    try {
      const contribution = await this.contributionsRepository.findOne({
        where: { id: updatedPayment.contribution.id },
        relations: ['event', 'event.organizer', 'wishlistItem', 'contributor'],
      });

      if (contribution) {
        await this.notificationsService.create({
          userId: contribution.contributor.id,
          eventId: contribution.event.id,
          type: 'PAYMENT_REFUNDED',
          title: 'Paiement remboursé',
          body: `Votre paiement pour "${contribution.wishlistItem.name}" a été remboursé.`,
          dataPayload: {
            paymentId: updatedPayment.id,
            contributionId: contribution.id,
            eventId: contribution.event.id,
            wishlistItemId: contribution.wishlistItem.id,
          },
        });

        const organizerId = contribution.event.organizer?.id;
        if (organizerId && organizerId !== contribution.contributor.id) {
          await this.notificationsService.create({
            userId: organizerId,
            eventId: contribution.event.id,
            type: 'EVENT_CONTRIBUTION_REFUNDED',
            title: 'Contribution remboursée',
            body: `Une contribution pour "${contribution.wishlistItem.name}" a été remboursée.`,
            dataPayload: {
              paymentId: updatedPayment.id,
              contributionId: contribution.id,
              contributorId: contribution.contributor.id,
              wishlistItemId: contribution.wishlistItem.id,
            },
          });
        }
      }
    } catch (error) {
      this.logger.warn(
        `Refund notifications failed | paymentId=${updatedPayment.id} error=${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    await this.auditService.log({
      userId: updatedPayment.payer.id,
      action: 'PAYMENT_REFUNDED',
      entityType: 'Payment',
      entityId: updatedPayment.id,
      metadata: {
        contributionId: updatedPayment.contribution.id,
        reason: refundPaymentDto.reason ?? null,
        note: refundPaymentDto.note ?? null,
      },
    });

    return updatedPayment;
  }

  async exportAdminPaymentsCsv(query: AdminPaymentsQueryDto) {
    const {
      sortBy = 'createdAt',
      order = 'DESC',
      status,
      provider,
      payerUserId,
      eventId,
      contributionId,
    } = query;

    const allowedSortFields = new Set([
      'createdAt',
      'updatedAt',
      'amount',
      'status',
      'provider',
      'initiatedAt',
      'confirmedAt',
      'failedAt',
      'refundedAt',
    ]);

    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';

    const qb = this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.payer', 'payer')
      .leftJoinAndSelect('payment.contribution', 'contribution')
      .leftJoinAndSelect('contribution.event', 'event')
      .leftJoinAndSelect('contribution.wishlistItem', 'wishlistItem');

    if (status) {
      qb.andWhere('payment.status = :status', { status });
    }

    if (provider) {
      qb.andWhere('payment.provider = :provider', { provider });
    }

    if (payerUserId) {
      qb.andWhere('payer.id = :payerUserId', { payerUserId });
    }

    if (eventId) {
      qb.andWhere('event.id = :eventId', { eventId });
    }

    if (contributionId) {
      qb.andWhere('contribution.id = :contributionId', { contributionId });
    }

    qb.orderBy(`payment.${safeSortBy}`, order as 'ASC' | 'DESC');

    const payments = await qb.getMany();

    const escapeCsv = (value: unknown): string => {
      if (value === null || value === undefined) {
        return '';
      }

      return `"${String(value).replace(/"/g, '""')}"`;
    };

    const headers = [
      'id',
      'provider',
      'providerTransactionId',
      'providerReference',
      'paymentMethod',
      'amount',
      'currencyCode',
      'status',
      'paymentUrl',
      'failureReason',
      'initiatedAt',
      'expiresAt',
      'confirmedAt',
      'failedAt',
      'refundedAt',
      'createdAt',
      'updatedAt',
      'payerId',
      'payerName',
      'payerEmail',
      'contributionId',
      'contributionStatus',
      'eventId',
      'eventTitle',
      'wishlistItemId',
      'wishlistItemName',
    ];

    const rows = payments.map((payment) =>
      [
        payment.id,
        payment.provider,
        payment.providerTransactionId,
        payment.providerReference,
        payment.paymentMethod,
        Number(payment.amount),
        payment.currencyCode,
        payment.status,
        payment.paymentUrl,
        payment.failureReason,
        payment.initiatedAt?.toISOString() ?? '',
        payment.expiresAt?.toISOString() ?? '',
        payment.confirmedAt?.toISOString() ?? '',
        payment.failedAt?.toISOString() ?? '',
        payment.refundedAt?.toISOString() ?? '',
        payment.createdAt?.toISOString() ?? '',
        payment.updatedAt?.toISOString() ?? '',
        payment.payer?.id ?? '',
        payment.payer?.name ?? '',
        payment.payer?.email ?? '',
        payment.contribution?.id ?? '',
        payment.contribution?.status ?? '',
        payment.contribution?.event?.id ?? '',
        payment.contribution?.event?.title ?? '',
        payment.contribution?.wishlistItem?.id ?? '',
        payment.contribution?.wishlistItem?.name ?? '',
      ]
        .map(escapeCsv)
        .join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }
  async logAdminPaymentsExport(
    actor: { userId: number; platformRole: PlatformRole },
    query: AdminPaymentsQueryDto,
  ) {
    await this.auditService.log({
      userId: actor.userId,
      action: 'PAYMENTS_EXPORTED',
      entityType: 'Payment',
      metadata: {
        actorRole: actor.platformRole,
        filters: query,
      },
    });
  }
}
