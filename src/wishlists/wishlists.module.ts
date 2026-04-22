import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WishlistsController } from './wishlists.controller';
import { WishlistsService } from './wishlists.service';
import { Wishlist } from './wishlist.entity';
import { Event } from '../events/event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Wishlist, Event])],
  controllers: [WishlistsController],
  providers: [WishlistsService],
})
export class WishlistsModule {}
