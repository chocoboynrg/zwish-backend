import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogProduct } from './catalog-product.entity';

@Entity('catalog_categories')
export class CatalogCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 150 })
  name: string;

  @Column({ unique: true, length: 180 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => CatalogProduct, (product) => product.category)
  products: CatalogProduct[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
