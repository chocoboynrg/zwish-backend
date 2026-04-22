import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contribution } from '../contributions/contribution.entity';
import { User } from '../users/user.entity';
import { PaymentProvider } from './enums/payment-provider.enum';
import { PaymentMethod } from './enums/payment-method.enum';
import { PaymentStatus } from './enums/payment-status.enum';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Contribution, (contribution) => contribution.payments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contribution_id' })
  contribution: Contribution;

  @ManyToOne(() => User, (user) => user.payments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payer_user_id' })
  payer: User;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    default: PaymentProvider.OTHER,
  })
  provider: PaymentProvider;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerTransactionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerReference: string | null;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.MOBILE_MONEY,
  })
  paymentMethod: PaymentMethod;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'XOF' })
  currencyCode: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.INITIATED,
  })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  paymentUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  initiatedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  failedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rawProviderPayload: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
