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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CatalogProductStatus } from './enums/catalog-product-status.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import {
  buildListResponse,
  buildItemResponse,
  buildActionResponse,
} from '../common/api/api-response.types';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PlatformRole } from '../users/enums/platform-role.enum';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ===== CATEGORIES =====

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Post('categories')
  async createCategory(@Body() dto: CreateCategoryDto) {
    const item = await this.catalogService.createCategory(dto);
    return buildItemResponse(item, 'Catégorie créée avec succès');
  }

  @Get('categories')
  async findAllCategories() {
    const items = await this.catalogService.findAllCategories();

    return buildListResponse(
      items,
      items.length,
      undefined,
      'Catégories récupérées avec succès',
    );
  }

  @Get('categories/:id')
  async findOneCategory(@Param('id', ParseIntPipe) id: number) {
    const item = await this.catalogService.findOneCategory(id);
    return buildItemResponse(item, 'Catégorie récupérée avec succès');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Patch('categories/:id')
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    const item = await this.catalogService.updateCategory(id, dto);
    return buildItemResponse(item, 'Catégorie mise à jour avec succès');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Delete('categories/:id')
  async removeCategory(@Param('id', ParseIntPipe) id: number) {
    const result = await this.catalogService.removeCategory(id);
    return buildActionResponse({ id: result.id }, result.message);
  }

  // ===== PRODUCTS =====

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Post('products')
  async createProduct(@Body() dto: CreateProductDto) {
    const item = await this.catalogService.createProduct(dto);
    return buildItemResponse(item, 'Produit créé avec succès');
  }

  @Get('products')
  async findAllProducts(
    @Query('search') search?: string,
    @Query('status') status?: CatalogProductStatus,
  ) {
    const items = await this.catalogService.findAllProducts(search, status);

    return buildListResponse(
      items,
      items.length,
      undefined,
      'Produits récupérés avec succès',
    );
  }

  @Get('products/:id')
  async findOneProduct(@Param('id', ParseIntPipe) id: number) {
    const item = await this.catalogService.findOneProduct(id);
    return buildItemResponse(item, 'Produit récupéré avec succès');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Patch('products/:id')
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    const item = await this.catalogService.updateProduct(id, dto);
    return buildItemResponse(item, 'Produit mis à jour avec succès');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Delete('products/:id')
  async removeProduct(@Param('id', ParseIntPipe) id: number) {
    const result = await this.catalogService.removeProduct(id);
    return buildActionResponse({ id: result.id }, result.message);
  }

  // ===== UPLOAD =====

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/products',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `product-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return {
        success: false,
        message: 'Aucun fichier reçu',
      };
    }

    const url = `/uploads/products/${file.filename}`;

    return {
      success: true,
      url,
    };
  }
}
