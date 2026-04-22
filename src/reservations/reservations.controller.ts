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

import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReleaseReservationDto } from './dto/release-reservation.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';

import { buildSuccessResponse } from '../common/api/api-response.types';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: JwtUser) {
    const data = await this.reservationsService.findAllByUser(user.userId);

    return buildSuccessResponse(data, 'Réservations récupérées');
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.reservationsService.findOneForUser(id, user.userId);

    return buildSuccessResponse({ item: data }, 'Réservation récupérée');
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() body: Omit<CreateReservationDto, 'reservedByUserId'>,
    @CurrentUser() user: JwtUser,
  ) {
    const item = await this.reservationsService.create({
      ...body,
      reservedByUserId: user.userId,
    });

    return buildSuccessResponse({ item }, 'Réservation créée');
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/release')
  async release(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReleaseReservationDto,
    @CurrentUser() user: JwtUser,
  ) {
    const item = await this.reservationsService.releaseForUser(
      id,
      user.userId,
      body,
    );

    return buildSuccessResponse({ item }, 'Réservation libérée');
  }

  @Patch('admin/cleanup')
  async cleanup() {
    const result = await this.reservationsService.cleanupExpiredReservations();

    return buildSuccessResponse(result, 'Cleanup effectué');
  }
}
