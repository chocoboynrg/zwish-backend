import { Body, Controller, Get, Post } from '@nestjs/common';
import { WishlistsService } from './wishlists.service';

@Controller('wishlists')
export class WishlistsController {
  constructor(private readonly wishlistsService: WishlistsService) {}

  @Get()
  getAllWishlists() {
    return this.wishlistsService.getAllWishlists();
  }

  @Post()
  createWishlist(
    @Body() body: { title: string; eventId: number; description?: string },
  ) {
    return this.wishlistsService.createWishlist(
      body.title,
      body.eventId,
      body.description,
    );
  }
}
