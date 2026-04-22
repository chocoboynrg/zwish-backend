import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WishlistItemsController } from './wishlist-items.controller';
import { WishlistItemsService } from './wishlist-items.service';
import { WishlistItem } from './wishlist-item.entity';
import { Wishlist } from '../wishlists/wishlist.entity';
import { Contribution } from '../contributions/contribution.entity';
import { EventParticipant } from '../participants/event-participant.entity';
import { Event } from '../events/event.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WishlistItem,
      Wishlist,
      Contribution,
      EventParticipant,
      Event,
    ]),
    AuthModule,
  ],
  controllers: [WishlistItemsController],
  providers: [WishlistItemsService],
  exports: [WishlistItemsService],
})
export class WishlistItemsModule {}
