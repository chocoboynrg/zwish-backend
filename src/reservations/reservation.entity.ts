import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';
import { WishlistItem } from '../wishlist-items/wishlist-item.entity';
import { ReservationStatus } from './enums/reservation-status.enum';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => WishlistItem, (wishlistItem) => wishlistItem.reservations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wishlist_item_id' })
  wishlistItem: WishlistItem;

  @ManyToOne(() => Event, (event) => event.reservations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @ManyToOne(() => User, (user) => user.reservations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reserved_by_user_id' })
  reservedBy: User;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.ACTIVE,
  })
  status: ReservationStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  reservedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  releasedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  releaseReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
