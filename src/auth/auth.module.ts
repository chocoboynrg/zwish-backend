import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { EventParticipant } from '../participants/event-participant.entity';
import { Event } from '../events/event.entity';
import { EventRoleGuard } from './event-role.guard';
import { Wishlist } from '../wishlists/wishlist.entity';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    UsersModule,
    MailModule,
    TypeOrmModule.forFeature([User, EventParticipant, Event, Wishlist]),
    JwtModule.register({
      secret:
        process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0
          ? process.env.JWT_SECRET
          : 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
    AuditModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60 * 1000,
        limit: 20,
        skipIf: () => process.env.NODE_ENV === 'test',
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    EventRoleGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [AuthService, EventRoleGuard],
})
export class AuthModule {}
