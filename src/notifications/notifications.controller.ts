import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PlatformRole } from '../users/enums/platform-role.enum';
import { buildSuccessResponse } from '../common/api/api-response.types';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Post()
  async create(@Body() dto: CreateNotificationDto) {
    const item = await this.notificationsService.create(dto);

    return buildSuccessResponse({ item }, 'Notification créée');
  }

  // ✅ Limite généreuse : appelé à chaque navigation
  @Throttle({ default: { limit: 200, ttl: 60 * 1000 } })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async findMyNotifications(@CurrentUser() user: JwtUser) {
    const items = await this.notificationsService.findMyNotifications(
      user.userId,
    );

    const unreadCount = items.filter((item) => item.status !== 'READ').length;

    return buildSuccessResponse(
      {
        items,
        total: items.length,
        summary: {
          unreadCount,
        },
      },
      'Notifications chargées',
    );
  }

  // ✅ Limite généreuse : appelé à chaque navigation
  @Throttle({ default: { limit: 200, ttl: 60 * 1000 } })
  @UseGuards(JwtAuthGuard)
  @Get('me/unread-count')
  async countUnread(@CurrentUser() user: JwtUser) {
    const data = await this.notificationsService.countUnread(user.userId);

    return buildSuccessResponse(
      data,
      'Nombre de notifications non lues chargé',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    const item = await this.notificationsService.findOneAccessible(
      id,
      user.userId,
    );

    return buildSuccessResponse({ item }, 'Notification chargée');
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    const item = await this.notificationsService.markAsRead(id, user.userId);

    return buildSuccessResponse({ item }, 'Notification marquée comme lue');
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/read-all')
  async markAllAsRead(@CurrentUser() user: JwtUser) {
    const data = await this.notificationsService.markAllAsRead(user.userId);

    return buildSuccessResponse(data, 'Notifications mises à jour');
  }
}
