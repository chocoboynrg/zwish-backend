import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event } from './event.entity';
import { User } from '../users/user.entity';
import { EventDashboardService } from './event-dashboard.service';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { Contribution } from '../contributions/contribution.entity';
import { EventParticipant } from '../participants/event-participant.entity';
import { WishlistItemsService } from '../wishlist-items/wishlist-items.service';
import { Wishlist } from '../wishlists/wishlist.entity';
import { Payment } from '../payments/payment.entity';
import { Reservation } from '../reservations/reservation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      User,
      WishlistItem,
      Contribution,
      EventParticipant,
      Wishlist,
      Payment,
      Reservation,
    ]),
  ],
  controllers: [EventsController],
  providers: [EventsService, EventDashboardService, WishlistItemsService],
  exports: [EventsService, EventDashboardService],
})
export class EventsModule {}
