import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { WishlistsModule } from './wishlists/wishlists.module';
import { WishlistItemsModule } from './wishlist-items/wishlist-items.module';
import { ReservationsModule } from './reservations/reservations.module';
import { ContributionsModule } from './contributions/contributions.module';
import { PaymentsModule } from './payments/payments.module';
import { ParticipantsModule } from './participants/participants.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CatalogModule } from './catalog/catalog.module';
import { ProductRequestsModule } from './product-requests/product-requests.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 2000,
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'wishlist_db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    UsersModule,
    EventsModule,
    WishlistsModule,
    WishlistItemsModule,
    ReservationsModule,
    ContributionsModule,
    PaymentsModule,
    ParticipantsModule,
    AuthModule,
    DashboardModule,
    CatalogModule,
    ProductRequestsModule,
    NotificationsModule,
    AuditModule,
  ],
})
export class AppModule {}
