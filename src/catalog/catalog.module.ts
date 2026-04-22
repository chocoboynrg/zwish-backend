import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogCategory } from './catalog-category.entity';
import { CatalogProduct } from './catalog-product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CatalogCategory, CatalogProduct])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
