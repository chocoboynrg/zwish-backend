import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Event } from '../events/event.entity';
import { Wishlist } from '../wishlists/wishlist.entity';
import { User } from '../users/user.entity';
import { CatalogCategory } from '../catalog/catalog-category.entity';
import { CatalogProduct } from '../catalog/catalog-product.entity';
import { ProductRequestStatus } from './enums/product-request-status.enum';

@Entity('product_requests')
export class ProductRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Event, {
    nullable: false,
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @ManyToOne(() => Wishlist, {
    nullable: false,
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'wishlist_id' })
  wishlist: Wishlist;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedBy: User;

  @ManyToOne(() => CatalogCategory, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'category_id' })
  category: CatalogCategory | null;

  @ManyToOne(() => CatalogProduct, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'approved_catalog_product_id' })
  approvedCatalogProduct: CatalogProduct | null;

  @Column({ length: 180 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  referenceUrl: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  estimatedPrice: number;

  @Column({ type: 'varchar', length: 10, default: 'XOF' })
  currencyCode: string;

  @Column({
    type: 'enum',
    enum: ProductRequestStatus,
    default: ProductRequestStatus.SUBMITTED,
  })
  status: ProductRequestStatus;

  @Column({ type: 'text', nullable: true })
  reviewComment: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
