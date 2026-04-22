import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';
import { EventParticipant } from './event-participant.entity';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';
import { Wishlist } from '../wishlists/wishlist.entity';
import { EventRoleGuard } from '../auth/event-role.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventParticipant, Event, User, Wishlist]),
    AuthModule,
  ],
  controllers: [ParticipantsController],
  providers: [ParticipantsService, EventRoleGuard],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
