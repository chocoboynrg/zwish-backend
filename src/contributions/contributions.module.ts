import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';
import { Contribution } from './contribution.entity';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { EventParticipant } from '../participants/event-participant.entity';
import { Reservation } from '../reservations/reservation.entity';
import { Payment } from '../payments/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contribution,
      Event,
      User,
      WishlistItem,
      EventParticipant,
      Reservation,
      Payment,
    ]),
  ],
  controllers: [ContributionsController],
  providers: [ContributionsService],
  exports: [ContributionsService],
})
export class ContributionsModule {}
