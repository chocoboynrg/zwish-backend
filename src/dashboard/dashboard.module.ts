import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';
import { EventParticipant } from '../participants/event-participant.entity';
import { Contribution } from '../contributions/contribution.entity';
import { Payment } from '../payments/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Event,
      EventParticipant,
      Contribution,
      Payment,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
