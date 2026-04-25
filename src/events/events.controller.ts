import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { EventDashboardService } from './event-dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WishlistItemsService } from '../wishlist-items/wishlist-items.service';
import type {
  EventWishlistFilter,
  EventWishlistSort,
} from '../wishlist-items/wishlist-items.service';
import type { JwtUser } from '../auth/jwt-user.type';
import { CreateEventDto } from './dto/create-event.dto';
import { buildSuccessResponse } from '../common/api/api-response.types';
import { EventRoles } from '../auth/event-roles.decorator';
import { EventRoleGuard } from '../auth/event-role.guard';
import { ParticipantRole } from '../participants/enums/participant-role.enum';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly eventDashboardService: EventDashboardService,
    private readonly wishlistItemsService: WishlistItemsService,
  ) {}

  @Get()
  async getAllEvents() {
    const items = await this.eventsService.getAllEvents();

    return buildSuccessResponse(
      {
        items,
        total: items.length,
      },
      'Événements récupérés avec succès',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createEvent(
    @Body() body: CreateEventDto,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.eventsService.createEvent(
      body.title,
      new Date(body.eventDate),
      user.userId,
      body.description,
    );

    return buildSuccessResponse(data, 'Événement créé avec succès');
  }

  @UseGuards(JwtAuthGuard, EventRoleGuard)
  @EventRoles(ParticipantRole.ORGANIZER, ParticipantRole.CO_ORGANIZER)
  @Get(':id/dashboard')
  async getDashboard(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.eventDashboardService.getEventDashboardSecured(
      id,
      user.userId,
    );

    return buildSuccessResponse(
      data,
      'Dashboard événement récupéré avec succès',
    );
  }

  @UseGuards(JwtAuthGuard, EventRoleGuard)
  @EventRoles(ParticipantRole.ORGANIZER, ParticipantRole.CO_ORGANIZER)
  @Get(':id/invite-link')
  async getInviteLink(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.eventsService.getInviteLink(id, req.user.userId);

    return buildSuccessResponse(data, 'Lien d’invitation généré avec succès');
  }

  @Get(':id/wishlist')
  async getEventWishlist(
    @Param('id', ParseIntPipe) id: number,
    @Query('filter') filter?: EventWishlistFilter,
    @Query('sort') sort?: EventWishlistSort,
  ) {
    const items = await this.wishlistItemsService.getEventWishlist(
      id,
      filter ?? 'all',
      sort ?? 'created_desc',
    );

    return buildSuccessResponse(
      {
        items,
        total: items.length,
      },
      'Wishlist récupérée avec succès',
    );
  }

  @Get('share/:shareToken/preview')
  async getEventPreviewByShareToken(@Param('shareToken') shareToken: string) {
    const data =
      await this.eventsService.getEventPreviewByShareToken(shareToken);

    return buildSuccessResponse(
      { item: data },
      'Aperçu événement récupéré avec succès',
    );
  }

  @UseGuards(JwtAuthGuard, EventRoleGuard)
  @EventRoles(
    ParticipantRole.ORGANIZER,
    ParticipantRole.CO_ORGANIZER,
    ParticipantRole.GUEST,
  )
  @Get(':id/my-view')
  async getMyEventView(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.eventsService.getMyEventView(id, user.userId);

    return buildSuccessResponse(
      data,
      'Vue utilisateur événement récupérée avec succès',
    );
  }

  @UseGuards(JwtAuthGuard, EventRoleGuard)
  @EventRoles(ParticipantRole.ORGANIZER)
  @Delete(':id')
  async deleteEvent(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    await this.eventsService.deleteEvent(id, user.userId);

    return buildSuccessResponse(null, 'Événement supprimé avec succès');
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/archive')
  async archiveEvent(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    await this.eventsService.archiveEvent(id, user.userId);
    return buildSuccessResponse(null, 'Événement archivé avec succès');
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/unarchive')
  async unarchiveEvent(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    await this.eventsService.unarchiveEvent(id, user.userId);
    return buildSuccessResponse(null, 'Événement désarchivé avec succès');
  }
}
