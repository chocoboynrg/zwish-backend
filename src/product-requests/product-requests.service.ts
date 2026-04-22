import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductRequest } from './product-request.entity';
import { Wishlist } from '../wishlists/wishlist.entity';
import { User } from '../users/user.entity';
import { CatalogCategory } from '../catalog/catalog-category.entity';
import { CatalogProduct } from '../catalog/catalog-product.entity';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { ReviewProductRequestDto } from './dto/review-product-request.dto';
import { ProductRequestStatus } from './enums/product-request-status.enum';
import { CatalogProductStatus } from '../catalog/enums/catalog-product-status.enum';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { FundingStatus } from '../wishlist-items/enums/funding-status.enum';
import { ReservationMode } from '../wishlist-items/enums/reservation-mode.enum';
import { PublishProductRequestDto } from './dto/publish-product-request.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProductRequestsService {
  constructor(
    @InjectRepository(ProductRequest)
    private readonly productRequestsRepository: Repository<ProductRequest>,

    @InjectRepository(Wishlist)
    private readonly wishlistsRepository: Repository<Wishlist>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(CatalogCategory)
    private readonly categoriesRepository: Repository<CatalogCategory>,

    @InjectRepository(CatalogProduct)
    private readonly productsRepository: Repository<CatalogProduct>,

    @InjectRepository(WishlistItem)
    private readonly wishlistItemsRepository: Repository<WishlistItem>,

    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateProductRequestDto, requestedByUserId: number) {
    const wishlist = await this.wishlistsRepository.findOne({
      where: { id: dto.wishlistId },
      relations: ['event'],
    });

    if (!wishlist) {
      throw new NotFoundException('Wishlist introuvable');
    }

    const user = await this.usersRepository.findOne({
      where: { id: requestedByUserId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    let category: CatalogCategory | null = null;

    if (dto.categoryId !== undefined) {
      category = await this.categoriesRepository.findOne({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Catégorie introuvable');
      }
    }

    const request = this.productRequestsRepository.create({
      event: wishlist.event,
      wishlist,
      requestedBy: user,
      category,
      approvedCatalogProduct: null,
      name: dto.name,
      description: dto.description ?? null,
      imageUrl: dto.imageUrl ?? null,
      referenceUrl: dto.referenceUrl ?? null,
      estimatedPrice: dto.estimatedPrice ?? 0,
      currencyCode: dto.currencyCode ?? 'XOF',
      status: ProductRequestStatus.SUBMITTED,
      reviewComment: null,
      reviewedAt: null,
    });

    const saved = await this.productRequestsRepository.save(request);

    // 🔥 notifier les admins
    const admins = await this.usersRepository.find({
      where: { platformRole: 'ADMIN' as any },
    });

    for (const admin of admins) {
      await this.notificationsService.create({
        userId: admin.id,
        eventId: saved.event.id,
        type: 'PRODUCT_REQUEST_SUBMITTED',
        title: 'Nouvelle demande produit',
        body: `Une nouvelle demande "${saved.name}" a été soumise.`,
        dataPayload: {
          productRequestId: saved.id,
          eventId: saved.event.id,
          wishlistId: saved.wishlist.id,
          requestedByUserId: saved.requestedBy.id,
        },
      });
    }

    return saved;
  }

  async findAll(status?: ProductRequestStatus) {
    if (status) {
      return this.productRequestsRepository.find({
        where: { status },
        order: { id: 'DESC' },
      });
    }

    return this.productRequestsRepository.find({
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number) {
    const request = await this.productRequestsRepository.findOne({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Demande produit introuvable');
    }

    return request;
  }

  async findByWishlist(wishlistId: number) {
    return this.productRequestsRepository.find({
      where: {
        wishlist: { id: wishlistId },
      },
      order: { id: 'DESC' },
    });
  }

  async review(id: number, dto: ReviewProductRequestDto) {
    const request = await this.findOne(id);

    if (
      dto.status !== ProductRequestStatus.APPROVED &&
      dto.status !== ProductRequestStatus.REJECTED &&
      dto.status !== ProductRequestStatus.UNDER_REVIEW &&
      dto.status !== ProductRequestStatus.PUBLISHED
    ) {
      throw new BadRequestException('Statut de review invalide');
    }

    if (dto.status === ProductRequestStatus.REJECTED) {
      request.status = ProductRequestStatus.REJECTED;
      request.reviewComment = dto.reviewComment ?? null;
      request.reviewedAt = new Date();

      const saved = await this.productRequestsRepository.save(request);

      await this.notificationsService.create({
        userId: saved.requestedBy.id,
        eventId: saved.event.id,
        type: 'PRODUCT_REQUEST_REJECTED',
        title: 'Demande produit rejetée',
        body: `Votre demande "${saved.name}" a été rejetée.`,
        dataPayload: {
          productRequestId: saved.id,
          status: saved.status,
          reviewComment: saved.reviewComment,
        },
      });

      return saved;
    }

    if (dto.status === ProductRequestStatus.UNDER_REVIEW) {
      request.status = ProductRequestStatus.UNDER_REVIEW;
      request.reviewComment = dto.reviewComment ?? null;
      request.reviewedAt = new Date();

      const saved = await this.productRequestsRepository.save(request);

      await this.notificationsService.create({
        userId: saved.requestedBy.id,
        eventId: saved.event.id,
        type: 'PRODUCT_REQUEST_UNDER_REVIEW',
        title: 'Demande produit en cours de traitement',
        body: `Votre demande "${saved.name}" est en cours de revue.`,
        dataPayload: {
          productRequestId: saved.id,
          status: saved.status,
        },
      });

      return saved;
    }

    let category = request.category;
    if (dto.categoryId !== undefined) {
      category = await this.categoriesRepository.findOne({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Catégorie introuvable');
      }
    }

    if (dto.approvedCatalogProductId !== undefined) {
      const existingProduct = await this.productsRepository.findOne({
        where: { id: dto.approvedCatalogProductId },
      });

      if (!existingProduct) {
        throw new NotFoundException('Produit catalogue introuvable');
      }

      request.approvedCatalogProduct = existingProduct;
      request.category = existingProduct.category;
      request.status = dto.status;
      request.reviewComment = dto.reviewComment ?? null;
      request.reviewedAt = new Date();

      const saved = await this.productRequestsRepository.save(request);

      await this.notificationsService.create({
        userId: saved.requestedBy.id,
        eventId: saved.event.id,
        type: 'PRODUCT_REQUEST_APPROVED',
        title: 'Demande produit approuvée',
        body: `Votre demande "${saved.name}" a été approuvée.`,
        dataPayload: {
          productRequestId: saved.id,
          approvedCatalogProductId: saved.approvedCatalogProduct?.id ?? null,
          status: saved.status,
        },
      });

      return saved;
    }

    if (
      dto.status === ProductRequestStatus.APPROVED ||
      dto.status === ProductRequestStatus.PUBLISHED
    ) {
      if (!category) {
        throw new BadRequestException(
          'Une catégorie est requise pour approuver ou publier une demande',
        );
      }

      const approvedProductName = dto.approvedProductName ?? request.name;
      const approvedProductSlug = dto.approvedProductSlug;

      if (!approvedProductSlug) {
        throw new BadRequestException(
          'approvedProductSlug est requis si aucun produit catalogue existant n’est fourni',
        );
      }

      const existingBySlug = await this.productsRepository.findOne({
        where: { slug: approvedProductSlug },
      });

      if (existingBySlug) {
        throw new ConflictException(
          'Un produit catalogue avec ce slug existe déjà',
        );
      }

      const newProduct = this.productsRepository.create({
        category,
        name: approvedProductName,
        slug: approvedProductSlug,
        description: request.description,
        mainImageUrl: request.imageUrl,
        referenceUrl: request.referenceUrl,
        brand: null,
        estimatedPrice: request.estimatedPrice,
        currencyCode: request.currencyCode,
        status: CatalogProductStatus.ACTIVE,
      });

      const savedProduct = await this.productsRepository.save(newProduct);

      request.approvedCatalogProduct = savedProduct;
      request.category = category;
      request.status = dto.status;
      request.reviewComment = dto.reviewComment ?? null;
      request.reviewedAt = new Date();

      const saved = await this.productRequestsRepository.save(request);

      await this.notificationsService.create({
        userId: saved.requestedBy.id,
        eventId: saved.event.id,
        type: 'PRODUCT_REQUEST_APPROVED',
        title: 'Demande produit approuvée',
        body: `Votre demande "${saved.name}" a été approuvée et ajoutée au catalogue.`,
        dataPayload: {
          productRequestId: saved.id,
          approvedCatalogProductId: saved.approvedCatalogProduct?.id ?? null,
          status: saved.status,
        },
      });

      return saved;
    }

    throw new BadRequestException('Transition de statut non gérée');
  }

  async publish(id: number, dto: PublishProductRequestDto) {
    return this.productRequestsRepository.manager.transaction(
      async (manager) => {
        const productRequestRepository = manager.getRepository(ProductRequest);
        const wishlistItemRepository = manager.getRepository(WishlistItem);

        const request = await productRequestRepository.findOne({
          where: { id },
        });

        if (!request) {
          throw new NotFoundException('Demande produit introuvable');
        }

        if (
          request.status !== ProductRequestStatus.APPROVED &&
          request.status !== ProductRequestStatus.PUBLISHED
        ) {
          throw new BadRequestException(
            'Seules les demandes approuvées peuvent être publiées',
          );
        }

        if (!request.wishlist) {
          throw new BadRequestException(
            'Aucune wishlist associée à cette demande',
          );
        }

        if (!request.event) {
          throw new BadRequestException(
            'Aucun événement associé à cette demande',
          );
        }

        if (request.status === ProductRequestStatus.PUBLISHED) {
          throw new BadRequestException('Cette demande est déjà publiée');
        }

        const quantity = dto.quantity ?? 1;
        const unitPrice = dto.price ?? Number(request.estimatedPrice ?? 0);

        const targetAmount = Number(unitPrice) * Number(quantity);

        const wishlistItem = wishlistItemRepository.create({
          name: dto.name ?? request.name,
          price: unitPrice,
          quantity,
          isReserved: false,
          reservationMode: ReservationMode.EXCLUSIVE,
          targetAmount,
          fundedAmount: 0,
          remainingAmount: targetAmount,
          fundingStatus: FundingStatus.NOT_FUNDED,
          eventId: request.event.id,
          event: request.event,
          wishlist: request.wishlist,
        });

        const savedItem = await wishlistItemRepository.save(wishlistItem);

        request.status = ProductRequestStatus.PUBLISHED;
        request.reviewedAt = new Date();

        await productRequestRepository.save(request);

        try {
          await this.notificationsService.create({
            userId: request.requestedBy.id,
            eventId: request.event.id,
            type: 'PRODUCT_REQUEST_PUBLISHED',
            title: 'Demande produit publiée',
            body: `Votre demande "${request.name}" a été publiée dans la wishlist.`,
            dataPayload: {
              productRequestId: request.id,
              wishlistItemId: savedItem.id,
              eventId: request.event.id,
              wishlistId: request.wishlist.id,
            },
          });
        } catch (_error) {
          // ne pas casser la publication pour une erreur de notification
        }

        return {
          message: 'Demande produit publiée avec succès',
          productRequest: {
            id: request.id,
            status: request.status,
            reviewedAt: request.reviewedAt,
          },
          wishlistItem: {
            id: savedItem.id,
            name: savedItem.name,
            price: Number(savedItem.price ?? 0),
            quantity: savedItem.quantity,
            targetAmount: Number(savedItem.targetAmount ?? 0),
            fundedAmount: Number(savedItem.fundedAmount ?? 0),
            remainingAmount: Number(savedItem.remainingAmount ?? 0),
            fundingStatus: savedItem.fundingStatus,
            eventId: savedItem.eventId,
            wishlistId: savedItem.wishlist?.id ?? null,
          },
        };
      },
    );
  }
}
