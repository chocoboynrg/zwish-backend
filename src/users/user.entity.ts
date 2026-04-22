import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { Reservation } from '../reservations/reservation.entity';
import { Contribution } from '../contributions/contribution.entity';
import { Payment } from '../payments/payment.entity';
import { PlatformRole } from './enums/platform-role.enum';
import { Notification } from '../notifications/notification.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: PlatformRole,
    default: PlatformRole.USER,
  })
  platformRole: PlatformRole;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  emailVerificationTokenHash: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  emailVerificationExpiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'boolean', default: false })
  isSuspended: boolean;

  @Column({ type: 'timestamp', nullable: true })
  suspendedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  suspensionReason: string | null;

  @OneToMany(() => Reservation, (r) => r.reservedBy)
  reservations: Reservation[];

  @OneToMany(() => Contribution, (c) => c.contributor)
  contributions: Contribution[];

  @OneToMany(() => Payment, (p) => p.payer)
  payments: Payment[];

  @OneToMany(() => Notification, (n) => n.user)
  notifications: Notification[];
}
