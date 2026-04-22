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
import { ParticipantsService } from './participants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { ParticipantRole } from './enums/participant-role.enum';
import { buildSuccessResponse } from '../common/api/api-response.types';
import { EventRoles } from '../auth/event-roles.decorator';
import { EventRoleGuard } from '../auth/event-role.guard';

@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @UseGuards(JwtAuthGuard, EventRoleGuard)
  @EventRoles(ParticipantRole.ORGANIZER, ParticipantRole.CO_ORGANIZER)
  @Get('event/:eventId')
  async getByEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.participantsService.getParticipantsByEvent(
      eventId,
      user.userId,
    );

    return buildSuccessResponse(data, 'Participants chargés');
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/role')
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { role: ParticipantRole.CO_ORGANIZER | ParticipantRole.GUEST },
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.participantsService.updateParticipantRole(
      id,
      body.role,
      user.userId,
    );

    return buildSuccessResponse(data, 'Rôle mis à jour');
  }

  @UseGuards(JwtAuthGuard)
  @Post('join/:token')
  async joinByToken(
    @Param('token') token: string,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.participantsService.joinByShareToken(
      token,
      user.userId,
    );

    return buildSuccessResponse(data, 'Participation confirmée');
  }
}
