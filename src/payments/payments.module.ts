import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpModule } from '@nestjs/axios';
import { Payment } from './payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Contribution } from '../contributions/contribution.entity';
import { User } from '../users/user.entity';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { Event } from '../events/event.entity';
import { EventParticipant } from '../participants/event-participant.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentWebhookGuard } from './payment-webhook.guard';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PaydunyaPaymentProvider } from './providers/paydunya-payment.provider';
import { PaymentWebhookEvent } from './payment-webhook-event.entity';
import { PaymentsCleanupService } from './payments-cleanup.service';
import { AuditModule } from '../audit/audit.module';
//import { FedaPayPaymentProvider } from './providers/fedapay-payment.provider';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    TypeOrmModule.forFeature([
      Payment,
      PaymentWebhookEvent,
      Contribution,
      User,
      WishlistItem,
      Event,
      EventParticipant,
    ]),
    NotificationsModule,
    AuditModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60 * 1000,
        limit: 100,
        skipIf: () => process.env.NODE_ENV === 'test',
      },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsCleanupService,
    PaymentWebhookGuard,
    PaymentProviderFactory,
    MockPaymentProvider,
    PaydunyaPaymentProvider,
    //FedaPayPaymentProvider,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [PaymentsService, TypeOrmModule],
})
export class PaymentsModule {}
