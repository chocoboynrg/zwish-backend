import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ContributionsService } from './contributions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { buildSuccessResponse } from '../common/api/api-response.types';

@Controller('contributions')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createContribution(
    @Body() body: Omit<CreateContributionDto, 'contributorUserId'>,
    @CurrentUser() user: JwtUser,
  ) {
    const item = await this.contributionsService.create({
      ...body,
      contributorUserId: user.userId,
    });

    return buildSuccessResponse(
      { item },
      'Contribution créée avec succès',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMine(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
  ) {
    const data = await this.contributionsService.getUserContributions(
      user.userId,
      status,
    );

    return buildSuccessResponse(
      data,
      'Mes contributions récupérées avec succès',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('event/:eventId')
  async getByEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.contributionsService.getContributionsByEvent(
      eventId,
      user.userId,
    );

    return buildSuccessResponse(
      data,
      'Contributions récupérées avec succès',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/confirm')
  async confirmContribution(@Param('id', ParseIntPipe) id: number) {
    const item = await this.contributionsService.markContributionAsConfirmed(id);

    return buildSuccessResponse(
      { item },
      'Contribution confirmée avec succès',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/fail')
  async failContribution(@Param('id', ParseIntPipe) id: number) {
    const item = await this.contributionsService.markContributionAsFailed(id);

    return buildSuccessResponse(
      { item },
      'Contribution échouée',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(
    @Body()
    body: {
      wishlistItemId: number;
      amount: number;
      currencyCode: string;
      message?: string;
      isAnonymous?: boolean;
    },
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.contributionsService.checkoutContribution(
      user.userId,
      body,
    );

    return buildSuccessResponse(
      result,
      'Contribution et paiement initialisés avec succès',
    );
  }
}
