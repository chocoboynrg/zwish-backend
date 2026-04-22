import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Wishlist } from '../wishlists/wishlist.entity';
import { Reservation } from '../reservations/reservation.entity';
import { ReservationMode } from './enums/reservation-mode.enum';
import { Contribution } from '../contributions/contribution.entity';
import { FundingStatus } from './enums/funding-status.enum';
import { Event } from '../events/event.entity';

@Entity('wishlist_items')
export class WishlistItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  price: number | null;

  @Column({ default: 1 })
  quantity: number;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ default: false })
  isReserved: boolean;

  @Column({
    type: 'enum',
    enum: ReservationMode,
    default: ReservationMode.EXCLUSIVE,
  })
  reservationMode: ReservationMode;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  targetAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  fundedAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  remainingAmount: number;

  @Column({
    type: 'enum',
    enum: FundingStatus,
    default: FundingStatus.NOT_FUNDED,
  })
  fundingStatus: FundingStatus;

  @Column({ name: 'event_id' })
  eventId: number;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @OneToMany(() => Reservation, (r) => r.wishlistItem)
  reservations: Reservation[];

  @ManyToOne(() => Wishlist, { eager: true })
  wishlist: Wishlist;

  @OneToMany(() => Contribution, (c) => c.wishlistItem)
  contributions: Contribution[];
}
