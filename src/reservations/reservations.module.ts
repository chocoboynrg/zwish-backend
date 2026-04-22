import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './reservation.entity';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';
import { AuditModule } from '../audit/audit.module';
import { ReservationsCleanupService } from './reservations.cleanup.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, WishlistItem, Event, User]),
    AuditModule,
    NotificationsModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationsCleanupService],
  exports: [ReservationsService, TypeOrmModule],
})
export class ReservationsModule {}
