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
import { User } from '../users/user.entity';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { ContributionStatus } from './enums/contribution-status.enum';
import { OneToMany } from 'typeorm';
import { Payment } from '../payments/payment.entity';

@Entity('contributions')
export class Contribution {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Event, (event) => event.contributions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @ManyToOne(() => WishlistItem, (wishlistItem) => wishlistItem.contributions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wishlist_item_id' })
  wishlistItem: WishlistItem;

  @ManyToOne(() => User, (user) => user.contributions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contributor_user_id' })
  contributor: User;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ length: 10, default: 'XOF' })
  currencyCode: string;

  @Column({ default: false })
  isAnonymous: boolean;

  @Column({
    type: 'enum',
    enum: ContributionStatus,
    default: ContributionStatus.AWAITING_PAYMENT,
  })
  status: ContributionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  message: string | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Payment, (payment) => payment.contribution)
  payments: Payment[];
}
