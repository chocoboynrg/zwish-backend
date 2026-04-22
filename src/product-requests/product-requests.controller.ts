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
import { ProductRequestsService } from './product-requests.service';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { ReviewProductRequestDto } from './dto/review-product-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { ProductRequestStatus } from './enums/product-request-status.enum';
import { PublishProductRequestDto } from './dto/publish-product-request.dto';
import { buildSuccessResponse } from '../common/api/api-response.types';

import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PlatformRole } from '../users/enums/platform-role.enum';

@Controller('product-requests')
export class ProductRequestsController {
  constructor(
    private readonly productRequestsService: ProductRequestsService,
  ) {}

  // ===== USER =====

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() dto: CreateProductRequestDto,
    @CurrentUser() user: JwtUser,
  ) {
    const item = await this.productRequestsService.create(dto, user.userId);

    return buildSuccessResponse(
      { item },
      'Demande produit envoyée avec succès',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('wishlist/:wishlistId')
  findByWishlist(@Param('wishlistId', ParseIntPipe) wishlistId: number) {
    return this.productRequestsService.findByWishlist(wishlistId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productRequestsService.findOne(id);
  }

  // ===== ADMIN =====

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get()
  findAll(@Query('status') status?: ProductRequestStatus) {
    return this.productRequestsService.findAll(status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Patch(':id/review')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewProductRequestDto,
  ) {
    return this.productRequestsService.review(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Patch(':id/publish')
  publish(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishProductRequestDto,
  ) {
    return this.productRequestsService.publish(id, dto);
  }
}
