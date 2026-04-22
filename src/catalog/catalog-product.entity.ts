import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogCategory } from './catalog-category.entity';
import { CatalogProductStatus } from './enums/catalog-product-status.enum';

@Entity('catalog_products')
export class CatalogProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CatalogCategory, (category) => category.products, {
    nullable: false,
    onDelete: 'RESTRICT',
    eager: true,
  })
  @JoinColumn({ name: 'category_id' })
  category: CatalogCategory;

  @Column({ length: 180 })
  name: string;

  @Column({ unique: true, length: 220 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  mainImageUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  referenceUrl: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  brand: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  estimatedPrice: number;

  @Column({ type: 'varchar', length: 10, default: 'XOF' })
  currencyCode: string;

  @Column({
    type: 'enum',
    enum: CatalogProductStatus,
    default: CatalogProductStatus.ACTIVE,
  })
  status: CatalogProductStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
