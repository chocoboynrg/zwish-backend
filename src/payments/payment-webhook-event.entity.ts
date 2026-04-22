import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Payment } from './payment.entity';

@Entity('payment_webhook_events')
@Unique(['eventKey'])
export class PaymentWebhookEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Payment, {
    nullable: false,
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 128 })
  eventKey: string;

  @Column({ type: 'varchar', length: 50 })
  externalStatus: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerTransactionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerReference: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureReason: string | null;

  @Column({ type: 'text', nullable: true })
  rawPayload: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  resultingPaymentStatus: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
