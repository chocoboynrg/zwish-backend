import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { Event } from '../events/event.entity';
import { EventParticipant } from '../participants/event-participant.entity';
import { AuditModule } from '../audit/audit.module';
import { Contribution } from '../contributions/contribution.entity';
import { Reservation } from '../reservations/reservation.entity';
import { Payment } from '../payments/payment.entity';
import { AuditLog } from '../audit/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Event,
      EventParticipant,
      Contribution,
      Reservation,
      Payment,
      Event,
      AuditLog,
    ]),
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
