import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { CatalogCategory } from './catalog-category.entity';
import { CatalogProduct } from './catalog-product.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CatalogProductStatus } from './enums/catalog-product-status.enum';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(CatalogCategory)
    private readonly categoriesRepository: Repository<CatalogCategory>,

    @InjectRepository(CatalogProduct)
    private readonly productsRepository: Repository<CatalogProduct>,
  ) {}

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.categoriesRepository.findOne({
      where: [{ name: dto.name }, { slug: dto.slug }],
    });

    if (existing) {
      throw new ConflictException('Une catégorie avec ce nom ou ce slug existe déjà');
    }

    const category = this.categoriesRepository.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });

    return this.categoriesRepository.save(category);
  }

  async findAllCategories() {
    return this.categoriesRepository.find({
      order: { id: 'DESC' },
    });
  }

  async findOneCategory(id: number) {
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Catégorie introuvable');
    }

    return category;
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const category = await this.findOneCategory(id);

    if (dto.name && dto.name !== category.name) {
      const existingByName = await this.categoriesRepository.findOne({
        where: { name: dto.name },
      });

      if (existingByName && existingByName.id !== id) {
        throw new ConflictException('Une catégorie avec ce nom existe déjà');
      }
    }

    if (dto.slug && dto.slug !== category.slug) {
      const existingBySlug = await this.categoriesRepository.findOne({
        where: { slug: dto.slug },
      });

      if (existingBySlug && existingBySlug.id !== id) {
        throw new ConflictException('Une catégorie avec ce slug existe déjà');
      }
    }

    Object.assign(category, {
      ...dto,
      description:
        dto.description !== undefined ? dto.description : category.description,
    });

    return this.categoriesRepository.save(category);
  }

  async removeCategory(id: number) {
    const category = await this.findOneCategory(id);
    await this.categoriesRepository.remove(category);

    return {
      message: 'Catégorie supprimée avec succès',
      id,
    };
  }

  async createProduct(dto: CreateProductDto) {
    const category = await this.categoriesRepository.findOne({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Catégorie introuvable');
    }

    const existing = await this.productsRepository.findOne({
      where: [{ name: dto.name }, { slug: dto.slug }],
    });

    if (existing) {
      throw new ConflictException('Un produit avec ce nom ou ce slug existe déjà');
    }

    const product = this.productsRepository.create({
      category,
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      mainImageUrl: dto.mainImageUrl ?? null,
      referenceUrl: dto.referenceUrl ?? null,
      brand: dto.brand ?? null,
      estimatedPrice: dto.estimatedPrice ?? 0,
      currencyCode: dto.currencyCode ?? 'XOF',
      status: dto.status ?? CatalogProductStatus.ACTIVE,
    });

    return this.productsRepository.save(product);
  }

  async findAllProducts(search?: string, status?: CatalogProductStatus) {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search && search.trim()) {
      return this.productsRepository.find({
        where: [
          { ...where, name: ILike(`%${search}%`) },
          { ...where, slug: ILike(`%${search}%`) },
          { ...where, brand: ILike(`%${search}%`) },
        ],
        order: { id: 'DESC' },
      });
    }

    return this.productsRepository.find({
      where,
      order: { id: 'DESC' },
    });
  }

  async findOneProduct(id: number) {
    const product = await this.productsRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Produit catalogue introuvable');
    }

    return product;
  }

  async updateProduct(id: number, dto: UpdateProductDto) {
    const product = await this.findOneProduct(id);

    if (dto.categoryId !== undefined) {
      const category = await this.categoriesRepository.findOne({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Catégorie introuvable');
      }

      product.category = category;
    }

    if (dto.name && dto.name !== product.name) {
      const existingByName = await this.productsRepository.findOne({
        where: { name: dto.name },
      });

      if (existingByName && existingByName.id !== id) {
        throw new ConflictException('Un produit avec ce nom existe déjà');
      }
    }

    if (dto.slug && dto.slug !== product.slug) {
      const existingBySlug = await this.productsRepository.findOne({
        where: { slug: dto.slug },
      });

      if (existingBySlug && existingBySlug.id !== id) {
        throw new ConflictException('Un produit avec ce slug existe déjà');
      }
    }

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.slug !== undefined) product.slug = dto.slug;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.mainImageUrl !== undefined) product.mainImageUrl = dto.mainImageUrl;
    if (dto.referenceUrl !== undefined) product.referenceUrl = dto.referenceUrl;
    if (dto.brand !== undefined) product.brand = dto.brand;
    if (dto.estimatedPrice !== undefined) product.estimatedPrice = dto.estimatedPrice;
    if (dto.currencyCode !== undefined) product.currencyCode = dto.currencyCode;
    if (dto.status !== undefined) product.status = dto.status;

    return this.productsRepository.save(product);
  }

  async removeProduct(id: number) {
    const product = await this.findOneProduct(id);
    await this.productsRepository.remove(product);

    return {
      message: 'Produit supprimé avec succès',
      id,
    };
  }
}
