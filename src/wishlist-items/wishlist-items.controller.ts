import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseIntPipe,
  UseGuards,
  Delete,
} from '@nestjs/common';

import { WishlistItemsService } from './wishlist-items.service';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';

import { buildSuccessResponse } from '../common/api/api-response.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventRoleGuard } from '../auth/event-role.guard';
import { EventRoles } from '../auth/event-roles.decorator';
import { ParticipantRole } from '../participants/enums/participant-role.enum';

@Controller('wishlist-items')
export class WishlistItemsController {
  constructor(private readonly wishlistItemsService: WishlistItemsService) {}

  @Get()
  async getAllWishlistItems() {
    const items = await this.wishlistItemsService.getAllWishlistItems();

    return buildSuccessResponse(
      {
        items,
        total: items.length,
      },
      'Wishlist items récupérés',
    );
  }

  // 🔥 PROTÉGÉ PAR LE GUARD
  @UseGuards(JwtAuthGuard, EventRoleGuard)
  @EventRoles(ParticipantRole.ORGANIZER, ParticipantRole.CO_ORGANIZER)
  @Post()
  async createWishlistItem(@Body() body: CreateWishlistItemDto) {
    const item = await this.wishlistItemsService.createWishlistItem(
      body.name,
      body.wishlistId,
      body.price,
      body.quantity,
      body.imageUrl,
    );

    return buildSuccessResponse({ item }, 'Item créé avec succès');
  }

  @Get(':id')
  async getWishlistItemDetails(@Param('id', ParseIntPipe) id: number) {
    const data = await this.wishlistItemsService.getWishlistItemDetails(id);

    return buildSuccessResponse(data, 'Détails récupérés');
  }

  @UseGuards(JwtAuthGuard, EventRoleGuard)
  @EventRoles(ParticipantRole.ORGANIZER, ParticipantRole.CO_ORGANIZER)
  @Delete(':id')
  async deleteWishlistItem(@Param('id', ParseIntPipe) id: number) {
    await this.wishlistItemsService.deleteWishlistItem(id);

    return buildSuccessResponse(null, 'Item supprimé avec succès');
  }
}
