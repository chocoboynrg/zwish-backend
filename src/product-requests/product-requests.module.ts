import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductRequest } from './product-request.entity';
import { ProductRequestsService } from './product-requests.service';
import { ProductRequestsController } from './product-requests.controller';

import { Wishlist } from '../wishlists/wishlist.entity';
import { User } from '../users/user.entity';
import { CatalogCategory } from '../catalog/catalog-category.entity';
import { CatalogProduct } from '../catalog/catalog-product.entity';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductRequest,
      Wishlist,
      User,
      CatalogCategory,
      CatalogProduct,
      WishlistItem,
    ]),
    NotificationsModule,
  ],
  controllers: [ProductRequestsController],
  providers: [ProductRequestsService],
  exports: [ProductRequestsService],
})
export class ProductRequestsModule {}
